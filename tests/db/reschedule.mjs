import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const P = new URL("../../supabase/migrations/", import.meta.url).pathname;
const db = new PGlite();
await db.exec(`create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
// pgcrypto is not bundled in PGlite; gen_random_uuid() is built in on modern Postgres.
await db.exec(readFileSync(P + "0001_schema.sql", "utf8").replace(/create extension if not exists "pgcrypto";/, ""));
await db.exec(readFileSync(P + "0002_task_reschedule_limit.sql", "utf8"));
console.log("migrations 0001 + 0002 applied");

const ok = [], bad = [];
const check = (name, cond, extra = "") => (cond ? ok : bad).push(name + (cond ? "" : ` ${extra}`));
const expectErr = async (name, sql, code) => { try { await db.query(sql); bad.push(`${name}: expected ${code}, got success`); } catch (e) { check(name, String(e.message).includes(code), e.message); } };

const { rows: [u] } = await db.query(`insert into auth.users(email) values ('a@b.c') returning id`);
const profile = (await db.query(`select * from profiles where user_id='${u.id}'`)).rows[0];
check("signup trigger created profile", !!profile);
const today = (await db.query(`select ((now() at time zone 'Asia/Kolkata')::date)::text d`)).rows[0].d;
const D = async (n) => (await db.query(`select ('${today}'::date + ${n})::text d`)).rows[0].d;
const [yest, tomorrow, lastWeek] = [await D(-1), await D(1), await D(-7)];
const task = async (id) => (await db.query(`select * from tasks where id='${id}'`)).rows[0];
const mk = async (title, due, status = "Todo") => (await db.query(`insert into tasks(user_id,title,due_date,status) values ('${u.id}','${title}','${due}','${status}') returning id`)).rows[0].id;
const forceOverdue = async (id) => { await db.exec(`alter table tasks disable trigger tasks_reschedule_limit; update tasks set due_date='${yest}' where id='${id}'; alter table tasks enable trigger tasks_reschedule_limit;`); };

const id = await mk("overdue one", lastWeek);
let t = await task(id);
check("insert starts at 0 edits", t.reschedule_count === 0 && t.original_due_date === null);

await db.query(`select * from reschedule_task('${id}', '${today}', '  ran out of time  ')`);
t = await task(id);
check("attempt 1 counted", t.reschedule_count === 1, JSON.stringify(t));
check("last edited timestamp set", t.last_rescheduled_at !== null);
check("original due date kept", String(t.original_due_date).startsWith(lastWeek) || t.original_due_date?.toISOString?.().startsWith(lastWeek), String(t.original_due_date));
check("reason trimmed and stored", t.last_reschedule_reason === "ran out of time", t.last_reschedule_reason);

await forceOverdue(id);
await expectErr("past date rejected", `update tasks set due_date='${lastWeek}' where id='${id}'`, "RESCHEDULE_PAST_DATE");
await expectErr("clearing date rejected on overdue", `update tasks set due_date=null where id='${id}'`, "RESCHEDULE_PAST_DATE");
t = await task(id); check("rejected attempts are not counted", t.reschedule_count === 1);

await db.query(`update tasks set due_date='${tomorrow}', reschedule_count=0, original_due_date='2000-01-01' where id='${id}'`);
t = await task(id);
check("attempt 2 counted; client cannot reset counter or original date", t.reschedule_count === 2 && !String(t.original_due_date).startsWith("2000"), JSON.stringify(t));

await forceOverdue(id);
await db.query(`select * from reschedule_task('${id}', '${today}')`);
t = await task(id); check("attempt 3 counted (via function, no reason)", t.reschedule_count === 3);
check("reason cleared when the new edit has none", t.last_reschedule_reason === null, t.last_reschedule_reason);
await forceOverdue(id);
await expectErr("4th edit blocked", `update tasks set due_date='${tomorrow}' where id='${id}'`, "RESCHEDULE_LIMIT");
t = await task(id); check("still 3 after blocked 4th", t.reschedule_count === 3 && String(t.due_date).startsWith(yest) || t.due_date?.toISOString?.().startsWith(yest));
await db.query(`update tasks set reschedule_count=0, last_reschedule_reason='hacked' where id='${id}'`);
t = await task(id); check("client cannot lower the counter or write the reason", t.reschedule_count === 3 && t.last_reschedule_reason === null, JSON.stringify(t));
await expectErr("function path also blocked at 4", `select * from reschedule_task('${id}', '${tomorrow}', 'please')`, "RESCHEDULE_LIMIT");
await db.query(`update tasks set title='renamed', priority='High' where id='${id}'`);
check("other edits still allowed when locked", (await task(id)).title === "renamed");
await db.query(`update tasks set status='Completed' where id='${id}'`);
check("locked task can still be completed", (await task(id)).status === "Completed");

const future = await mk("future", tomorrow);
await db.query(`update tasks set due_date='${await D(5)}' where id='${future}'`);
check("editing a not-yet-overdue date is free", (await task(future)).reschedule_count === 0);
const done = await mk("done late", lastWeek, "Completed");
await db.query(`update tasks set due_date='${tomorrow}' where id='${done}'`);
check("completed tasks are not limited", (await task(done)).reschedule_count === 0);
const direct = await mk("direct edit", lastWeek);
await db.query(`update tasks set due_date='${today}' where id='${direct}'`);
check("direct (non-function) edit is counted with no reason", (await task(direct)).reschedule_count === 1 && (await task(direct)).last_reschedule_reason === null);
await expectErr("function on a missing task", `select * from reschedule_task('${u.id}', '${tomorrow}')`, "TASK_NOT_FOUND");
const forged = (await db.query(`insert into tasks(user_id,title,reschedule_count) values ('${u.id}','forged',2) returning reschedule_count`)).rows[0];
check("cannot insert with a pre-set counter", forged.reschedule_count === 0);

console.log("PASS:", ok.length); ok.forEach((x) => console.log("  ok  ", x));
console.log("FAIL:", bad.length); bad.forEach((x) => console.log("  FAIL", x));
process.exit(bad.length ? 1 : 0);
