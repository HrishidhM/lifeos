import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { completionPct, savings, savingsRate } from "@/utils/calc";

const count = (rows: { [k: string]: string }[], key: string) => Object.entries(rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r[key]]: (a[r[key]] ?? 0) + 1 }), {}));

export default async function AnalyticsPage() {
  const db = await createClient();
  const since = format(subDays(new Date(), 30), "yyyy-MM-dd"), today = format(new Date(), "yyyy-MM-dd");
  const [tasks, goals, inc, exp] = await Promise.all([
    db.from("tasks").select("status,priority,due_date").gte("created_at", since),
    db.from("goals").select("goal_horizon,status"),
    db.from("income").select("amount").gte("date", since),
    db.from("expenses").select("amount,category").gte("date", since),
  ]);
  if ([tasks, goals, inc, exp].some((r) => r.error)) return <p role="alert" className="text-danger">Could not load analytics.</p>;
  const T = tasks.data ?? [], done = T.filter((t) => t.status === "Completed").length;
  const overdue = T.filter((t) => t.due_date && t.due_date < today && ["Todo", "In Progress"].includes(t.status)).length;
  const sum = (r: { amount: number | string }[]) => r.reduce((a, x) => a + Number(x.amount), 0);
  const i = sum(inc.data ?? []), e = sum(exp.data ?? []);
  const list = (rows: [string, number][]) => rows.length ? <ul className="text-sm space-y-1">{rows.map(([k, v]) => <li key={k}>{k}: <b>{v}</b></li>)}</ul> : <p className="text-sm text-muted">No data yet.</p>;
  const box = (t: string, c: React.ReactNode) => <section className="bg-panel border border-line rounded-lg p-4 space-y-2"><h2 className="font-semibold">{t}</h2>{c}</section>;
  return (
    <div className="space-y-4"><h1 className="text-2xl font-bold">Analytics</h1><p className="text-sm text-muted">Last 30 days</p>
      <div className="grid md:grid-cols-2 gap-3">
        {box("Productivity", <><p className="text-sm">{done} of {T.length} tasks completed ({Math.round(completionPct(done, T.length))}%) · {overdue} overdue</p>{list(count(T as never, "priority"))}</>)}
        {box("Goals by horizon", list(count((goals.data ?? []) as never, "goal_horizon")))}
        {box("Finance", <p className="text-sm">Income {i.toFixed(2)} · Expenses {e.toFixed(2)} · Savings {savings(i, e).toFixed(2)} ({savingsRate(i, e).toFixed(0)}%)</p>)}
        {box("Top expense categories", list(count((exp.data ?? []) as never, "category")))}
      </div></div>
  );
}
