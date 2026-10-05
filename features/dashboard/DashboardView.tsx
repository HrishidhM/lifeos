"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Flame, ShoppingBag } from "lucide-react";
import { Badge, Card, Delta, Empty, ProgressBar, Stat, Tabs } from "@/components/ui";
import { ChartCard, Donut, HBars, TrendChart, tableOf } from "@/components/charts";
import { createClient } from "@/lib/supabase/client";
import { completeTask, reopenTask } from "@/lib/services/tasks";
import { toggleHabit } from "@/lib/services/habits";
import { HORIZONS, type Goal } from "@/lib/services/goals";
import type { DashboardData, DashTask } from "@/lib/services/dashboard";
import { budgetStatus, budgetUsage, completionPct, pctChange, savingsRate } from "@/utils/calc";
import { diffDays, localDay, longDate, shortDate } from "@/utils/dates";
import { compact, money } from "@/utils/format";
import { goalHealth, healthLabel, type Health } from "@/utils/goals";
import { completionRate, currentStreak } from "@/utils/streak";

type GoalTab = "All" | "Overdue" | (typeof HORIZONS)[number];
type FinTab = "trend" | "savings" | "categories";
const tone = (h: Health) => (h.state === "overdue" ? "danger" : h.state === "due-soon" ? "warn" : h.state === "done" ? "ok" : "muted");
const open = (g: Goal) => g.status !== "Completed" && g.status !== "Cancelled";
const rank = (h: Health) => (h.state === "overdue" ? 0 : h.state === "due-soon" ? 1 : 2);

export default function DashboardView({ data }: { data: DashboardData }) {
  const router = useRouter();
  const { ctx, goals, milestones, finance } = data, { today, currency } = ctx;
  const fmt = (n: number) => money(n, currency), fmtC = (n: number) => compact(n, currency);
  const [tasks, setTasks] = useState(data.todayTasks), [overdue, setOverdue] = useState(data.overdueTasks), [habits, setHabits] = useState(data.habits);
  const [goalTab, setGoalTab] = useState<GoalTab>("All"), [finTab, setFinTab] = useState<FinTab>("trend"), [cat, setCat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Re-sync optimistic state when fresh server data arrives (adjusting state during render, not in an effect).
  const [seen, setSeen] = useState(data);
  if (seen !== data) { setSeen(data); setTasks(data.todayTasks); setOverdue(data.overdueTasks); setHabits(data.habits); }

  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const openGoals = goals.filter(open);
  const withHealth = openGoals.map((g) => ({ g, h: goalHealth(g, today) })).sort((a, b) => rank(a.h) - rank(b.h) || (a.g.target_date ?? "9").localeCompare(b.g.target_date ?? "9"));
  const overdueGoals = withHealth.filter((x) => x.h.state === "overdue");
  const overdueMiles = milestones.filter((m) => m.target_date && m.target_date < today);
  const attention = overdueGoals.length + overdueMiles.length + data.overdueTaskCount;
  const milesByGoal = useMemo(() => { const m = new Map<string, number>(); milestones.forEach((x) => m.set(x.goal_id, (m.get(x.goal_id) ?? 0) + 1)); return m; }, [milestones]);

  const done = tasks.filter((t) => t.status === "Completed").length, total = tasks.length;
  const todayPct = Math.round(completionPct(done, total));
  const hour = ctx.hour, greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const habitsDone = habits.filter((h) => h.dates.includes(today)).length;
  const weekly = habits.length ? Math.round(habits.reduce((a, h) => a + completionRate(h.dates, today, 7), 0) / habits.length) : 0;
  const bestStreak = habits.reduce((a, h) => Math.max(a, currentStreak(h.dates, today)), 0);

  const savings = finance.income - finance.expenses, rate = savingsRate(finance.income, finance.expenses);
  const prevM = finance.months[4];
  const activeDebts = data.debts.filter((d) => d.status === "Active"), debtRemaining = data.debts.reduce((a, d) => a + d.remaining_amount, 0), debtOriginal = data.debts.reduce((a, d) => a + d.original_amount, 0);
  const planned = data.shopping.reduce((a, s) => a + (s.estimated_price ?? 0), 0);

  async function run(fn: () => Promise<unknown>, rollback?: () => void) {
    try { await fn(); setError(null); router.refresh(); } catch (e) { rollback?.(); setError(e instanceof Error ? e.message : "Something went wrong."); }
  }
  function toggleTask(t: DashTask) {
    const wasDone = t.status === "Completed", prev = tasks;
    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, status: wasDone ? "Todo" : "Completed" } : x)));
    run(() => (wasDone ? reopenTask : completeTask)(createClient(), t.id), () => setTasks(prev));
  }
  function finishOverdue(t: DashTask) { const prev = overdue; setOverdue(overdue.filter((x) => x.id !== t.id)); run(() => completeTask(createClient(), t.id), () => setOverdue(prev)); }
  function tickHabit(id: string) {
    const h = habits.find((x) => x.id === id)!, was = h.dates.includes(today), prev = habits;
    setHabits(habits.map((x) => (x.id === id ? { ...x, dates: was ? x.dates.filter((d) => d !== today) : [...x.dates, today] } : x)));
    run(() => toggleHabit(createClient(), h, today, was), () => setHabits(prev));
  }

  const tabGoals = withHealth.filter(({ g, h }) => goalTab === "All" || (goalTab === "Overdue" ? h.state === "overdue" : g.goal_horizon === goalTab));
  const goalTabs = [{ id: "All" as GoalTab, label: "All", count: openGoals.length }, { id: "Overdue" as GoalTab, label: "Overdue", count: overdueGoals.length },
    ...HORIZONS.map((h) => ({ id: h as GoalTab, label: h, count: openGoals.filter((g) => g.goal_horizon === h).length })).filter((t) => t.count > 0)];
  const byHorizon = HORIZONS.map((h) => { const gs = goals.filter((g) => g.goal_horizon === h && g.status !== "Cancelled"); return { name: h, value: gs.length ? Math.round(gs.reduce((a, g) => a + g.progress_percentage, 0) / gs.length) : -1 }; }).filter((x) => x.value >= 0);
  const upcomingMiles = milestones.slice(0, 5);
  const shopUpcoming = [...data.shopping].filter((s) => s.planned_date).sort((a, b) => a.planned_date!.localeCompare(b.planned_date!)).slice(0, 3);
  const debtDue = activeDebts.filter((d) => d.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).slice(0, 3);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-bold">{greeting}{ctx.name ? `, ${ctx.name.split(" ")[0]}` : ""}</h1><p className="text-sm text-muted">{longDate(today)}</p></div>
        {attention > 0 ? <a href="#attention"><Badge tone="danger">{attention} overdue item{attention > 1 ? "s" : ""} need attention</Badge></a> : <Badge tone="ok">Nothing overdue</Badge>}
      </header>
      {error && <p role="alert" className="rounded border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Today's tasks" value={`${done} / ${total}`} href="/today" sub={<ProgressBar value={todayPct} label="Today's progress" className="mt-1" />} />
        <Stat label="Overdue" value={attention} tone={attention ? "danger" : undefined} href={attention ? "#attention" : "/tasks"} sub={`${data.overdueTaskCount} tasks · ${overdueGoals.length} goals · ${overdueMiles.length} milestones`} />
        <Stat label="Savings this month" value={fmt(savings)} href="/finance" sub={<Delta value={pctChange(savings, prevM.Savings)} goodWhenUp label="last month" />} />
        <Stat label="Debt remaining" value={fmt(debtRemaining)} href="/debt" sub={debtOriginal ? `${Math.round(completionPct(debtOriginal - debtRemaining, debtOriginal))}% paid off` : "No debts"} />
        <Stat label="Habits today" value={`${habitsDone} / ${habits.length}`} href="/habits" sub={<span className="inline-flex items-center gap-1"><Flame size={12} aria-hidden />{bestStreak}-day best streak</span>} />
      </div>

      {attention > 0 && (
        <Card id="attention" title="Needs attention" danger>
          <div className="grid gap-4 md:grid-cols-3">
            <div><h3 className="mb-1 text-sm font-medium">Goals past their deadline ({overdueGoals.length})</h3>
              {overdueGoals.length === 0 ? <Empty>None</Empty> : <ul className="space-y-1 text-sm">{overdueGoals.slice(0, 5).map(({ g, h }) => <li key={g.id}><Link className="underline" href={`/goals/${g.id}`}>{g.title}</Link> <span className="text-danger">{healthLabel(h)}</span></li>)}</ul>}</div>
            <div><h3 className="mb-1 text-sm font-medium">Milestones past due ({overdueMiles.length})</h3>
              {overdueMiles.length === 0 ? <Empty>None</Empty> : <ul className="space-y-1 text-sm">{overdueMiles.slice(0, 5).map((m) => <li key={m.id}><Link className="underline" href={`/goals/${m.goal_id}`}>{m.title}</Link> <span className="text-danger">Overdue by {diffDays(today, m.target_date!)}d</span></li>)}</ul>}</div>
            <div><h3 className="mb-1 text-sm font-medium">Tasks past due ({data.overdueTaskCount})</h3>
              {overdue.length === 0 ? <Empty>None</Empty> : <ul className="space-y-1 text-sm">{overdue.slice(0, 5).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-2"><span>{t.title}</span><span className="text-danger">{diffDays(today, t.due_date!)}d late</span>
                  <Link className="text-xs text-accent underline" href="/tasks#overdue">Edit date</Link><button className="text-xs text-accent underline" onClick={() => finishOverdue(t)}>Done</button></li>))}</ul>}</div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Today" href="/today" className="lg:col-span-1">
          {total === 0 ? <Empty>No tasks today. Enjoy the free space, or <Link href="/tasks" className="text-accent underline">add a task</Link>.</Empty> : (
            <ul className="space-y-2">
              {tasks.map((t) => { const g = t.goal_id ? goalById.get(t.goal_id) : undefined; return (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 size-4" checked={t.status === "Completed"} onChange={() => toggleTask(t)} aria-label={`Mark "${t.title}" complete`} />
                  <div className="min-w-0 flex-1"><p className={t.status === "Completed" ? "text-muted line-through" : ""}>{t.title}</p>
                    <p className="text-xs text-muted">{t.priority}{g && <> · <Link className="underline" href={`/goals/${g.id}`}>{g.title}</Link></>}</p></div>
                  {(t.priority === "High" || t.priority === "Critical") && t.status !== "Completed" && <Badge tone="warn">{t.priority}</Badge>}
                </li>); })}
            </ul>
          )}
        </Card>

        <Card title="Goals" href="/goals" linkLabel="All goals" className="lg:col-span-2">
          {goals.length === 0 ? <Empty>No goals yet. <Link href="/goals" className="text-accent underline">Start by creating a goal</Link>.</Empty> : (<>
            <Tabs tabs={goalTabs} value={goalTab} onChange={setGoalTab} label="Filter goals" />
            <div role="tabpanel" className="mt-3">
              {tabGoals.length === 0 ? <Empty>{goalTab === "Overdue" ? "No overdue goals. Nice work." : "No goals here yet."}</Empty> : (
                <ul className="space-y-2">{tabGoals.slice(0, 6).map(({ g, h }) => (
                  <li key={g.id}><Link href={`/goals/${g.id}`} className={`block rounded-md border border-line p-2 hover:border-accent ${h.state === "overdue" ? "row-overdue bg-danger/5" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2"><span className="flex-1 font-medium">{g.title}</span><Badge tone={tone(h)}>{healthLabel(h)}</Badge></div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted"><span>{g.goal_horizon} · {g.category}{milesByGoal.get(g.id) ? ` · ${milesByGoal.get(g.id)} open milestone${milesByGoal.get(g.id)! > 1 ? "s" : ""}` : ""}</span>
                      <ProgressBar value={g.progress_percentage} label={`${g.title} progress`} tone={h.state === "overdue" ? "danger" : "ok"} className="ml-auto w-28" /><span className="w-9 text-right">{Math.round(g.progress_percentage)}%</span></div></Link></li>))}</ul>)}
              {tabGoals.length > 6 && <p className="mt-2 text-xs text-muted">+{tabGoals.length - 6} more in <Link href="/goals" className="underline">Goals</Link></p>}
            </div></>)}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Average progress by horizon" subtitle="Click a bar to filter the goals list" table={{ head: ["Horizon", "Avg progress"], rows: byHorizon.map((b) => [b.name, `${b.value}%`]) }}>
          {byHorizon.length === 0 ? <Empty>Goal progress appears here once you add goals.</Empty> : <HBars data={byHorizon} max={100} format={(n) => `${n}%`} label="Average goal progress by horizon" selected={goalTab === "All" || goalTab === "Overdue" ? null : goalTab} onSelect={(n) => setGoalTab(n as GoalTab)} />}
        </ChartCard>
        <Card title="Upcoming milestones" href="/goals">
          {upcomingMiles.length === 0 ? <Empty>No open milestones. Add milestones on a goal page.</Empty> : (
            <ul className="space-y-2 text-sm">{upcomingMiles.map((m) => { const late = !!m.target_date && m.target_date < today; return (
              <li key={m.id} className={`rounded-md border border-line p-2 ${late ? "row-overdue bg-danger/5" : ""}`}><Link className="font-medium underline" href={`/goals/${m.goal_id}`}>{m.title}</Link>
                <p className="text-xs text-muted">{goalById.get(m.goal_id)?.title ?? "Goal"} · {m.target_date ? (late ? <span className="font-semibold text-danger">Overdue by {diffDays(today, m.target_date)}d</span> : `Due ${shortDate(m.target_date)}`) : "No date"}</p></li>); })}</ul>)}
        </Card>
        <ChartCard title="Tasks completed" subtitle="Last 14 days" table={tableOf(data.completedByDay, "label", [{ key: "Completed" }])}>
          <TrendChart data={data.completedByDay} series={[{ key: "Completed" }]} height={190} label="Tasks completed per day over the last 14 days" />
        </ChartCard>
      </div>

      <Card title="Finance this month" href="/finance" linkLabel="Open finance"
        action={<Tabs tabs={[{ id: "trend" as FinTab, label: "Income vs expenses" }, { id: "savings" as FinTab, label: "Savings" }, { id: "categories" as FinTab, label: "Categories" }]} value={finTab} onChange={setFinTab} label="Finance chart" />}>
        <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-muted">Income</p><p className="font-semibold">{fmt(finance.income)}</p></div>
          <div><p className="text-xs text-muted">Expenses</p><p className="font-semibold">{fmt(finance.expenses)}</p></div>
          <div><p className="text-xs text-muted">Savings</p><p className="font-semibold">{fmt(savings)}</p></div>
          <div><p className="text-xs text-muted">Savings rate</p><p className="font-semibold">{Math.round(rate)}%</p></div>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div role="tabpanel">
            {finTab === "trend" && <TrendChart data={finance.months} series={[{ key: "Income" }, { key: "Expenses" }]} format={fmtC} height={220} label="Income versus expenses for the last six months" />}
            {finTab === "savings" && <TrendChart data={finance.months} series={[{ key: "Savings", color: "var(--c3)" }]} kind="area" format={fmtC} height={220} label="Savings for the last six months" />}
            {finTab === "categories" && (finance.categories.length === 0 ? <Empty>No expenses recorded this month.</Empty> : <Donut data={finance.categories} format={fmt} selected={cat} onSelect={setCat} label="Spending by category this month" total={fmt(finance.expenses)} />)}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Budgets</h3>
            {finance.budgets.length === 0 ? <Empty>No budgets set. <Link href="/finance" className="text-accent underline">Create one</Link>.</Empty> : (
              <ul className="space-y-2">{finance.budgets.map((b) => { const u = budgetUsage(b.amount, b.spent), s = budgetStatus(u); return (
                <li key={b.category} className="text-sm"><div className="flex justify-between"><span>{b.category}</span>
                  <span className={s === "ok" ? "text-muted" : s === "over" ? "font-semibold text-danger" : "font-semibold text-warn"}>{Math.round(u)}%{s === "over" ? " · Over budget" : s === "critical" ? " · Over 90%" : s === "warning" ? " · Over 80%" : ""}</span></div>
                  <ProgressBar value={u} label={`${b.category} budget used`} tone={s === "ok" ? "ok" : s === "over" ? "danger" : "warn"} className="mt-1" />
                  <p className="text-xs text-muted">{fmt(b.spent)} of {fmt(b.amount)}</p></li>); })}</ul>)}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Habits" href="/habits">
          {habits.length === 0 ? <Empty>No habits yet. Add one to start a streak.</Empty> : (<>
            <p className="mb-2 text-xs text-muted">{weekly}% weekly completion</p>
            <ul className="space-y-2">{habits.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={h.dates.includes(today)} onChange={() => tickHabit(h.id)} aria-label={`${h.name}: done today`} />
                <span className="flex-1">{h.name}</span><span className="text-xs text-muted">{Math.round(completionRate(h.dates, today, 7) / 100 * 7)}/7 this week</span></li>))}</ul></>)}
        </Card>
        <Card title="Debt" href="/debt">
          {data.debts.length === 0 ? <Empty>No debts recorded.</Empty> : (<>
            <p className="text-sm">{fmt(debtRemaining)} remaining of {fmt(debtOriginal)}</p>
            <ProgressBar value={completionPct(debtOriginal - debtRemaining, debtOriginal)} label="Debt paid off" className="my-2" />
            <ul className="space-y-1 text-sm">{debtDue.map((d) => { const late = d.due_date! < today; return <li key={d.id}>{d.creditor} · {late ? <span className="font-semibold text-danger">Overdue since {shortDate(d.due_date!)}</span> : `due ${shortDate(d.due_date!)}`}{d.minimum_payment ? ` · min ${fmt(d.minimum_payment)}` : ""}</li>; })}</ul></>)}
        </Card>
        <Card title="Shopping" href="/shopping">
          {data.shopping.length === 0 ? <Empty><ShoppingBag size={14} className="mr-1 inline" aria-hidden />No planned purchases yet.</Empty> : (<>
            <p className="text-sm">{data.shopping.length} planned · {fmt(planned)} · {data.shopping.filter((s) => s.priority === "High" || s.priority === "Critical").length} high priority</p>
            <ul className="mt-2 space-y-1 text-sm">{shopUpcoming.map((s) => <li key={s.id}>{s.item} <span className="text-muted">· {shortDate(s.planned_date!)}{s.estimated_price ? ` · ${fmt(s.estimated_price)}` : ""}</span></li>)}</ul></>)}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Upcoming events" href="/calendar" linkLabel="Calendar">
          {data.events.length === 0 ? <Empty><CalendarClock size={14} className="mr-1 inline" aria-hidden />No upcoming events. Deadlines appear in the Calendar.</Empty> :
            <ul className="space-y-1 text-sm">{data.events.map((e) => <li key={e.id}>{e.title} <span className="text-muted">· {shortDate(localDay(e.start_time, ctx.timezone))}</span></li>)}</ul>}
        </Card>
        <Card title="Recent activity">
          {data.activity.length === 0 ? <Empty>Your actions will show up here.</Empty> :
            <ul className="space-y-1 text-sm">{data.activity.map((a) => <li key={a.id} className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span className="flex-1">{a.description ?? a.type}</span><span className="text-xs text-muted">{shortDate(localDay(a.created_at, ctx.timezone))}</span></li>)}</ul>}
        </Card>
      </div>
    </div>
  );
}
