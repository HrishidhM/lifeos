"use client";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, Empty, ProgressBar, Stat, Tabs } from "@/components/ui";
import { ChartCard, Donut, HBars, Heatmap, TrendChart, tableOf } from "@/components/charts";
import { createClient } from "@/lib/supabase/client";
import { getAnalytics, type AnalyticsRaw } from "@/lib/services/analytics";
import { PRESETS, bucketLabel, bucketList, foldTop, granularityFor, groupTotals, habitStats, productivityStats, rangeFor, rowsInBucket, sumBy, type Preset } from "@/utils/analytics";
import { addDays, diffDays, localDay, monthLabel, monthStart, shortDate } from "@/utils/dates";
import { budgetStatus, budgetUsage, savings, savingsRate } from "@/utils/calc";
import { compact, money } from "@/utils/format";
import { HORIZON_ORDER, goalHealth, healthLabel, isStale } from "@/utils/goals";

type Section = "productivity" | "goals" | "finance" | "habits";
const HORIZONS_UP = ["Daily", "Short-Term", "Medium-Term", "Long-Term", "5-Year", "10-Year"] as const;

export default function AnalyticsView({ today, currency, timezone }: { today: string; currency: string; timezone: string }) {
  const [preset, setPreset] = useState<Preset>("30d"), [custom, setCustom] = useState({ from: addDays(today, -29), to: today });
  const [section, setSection] = useState<Section>("productivity"), [attempt, setAttempt] = useState(0);
  const [cat, setCat] = useState<string | null>(null), [stage, setStage] = useState<string | null>(null);
  const [res, setRes] = useState<{ key: string; raw?: AnalyticsRaw; range?: { from: string; to: string }; error?: string } | null>(null);

  const customError = preset !== "custom" ? null : custom.from > custom.to ? "Start date must be before the end date." : diffDays(custom.to, custom.from) > 730 ? "Choose a range of two years or less." : null;
  const range = useMemo(() => rangeFor(preset, today, custom), [preset, today, custom]);
  const key = `${range.from}|${range.to}`;
  useEffect(() => {
    if (customError) return;
    let live = true;
    getAnalytics(createClient(), range.from, range.to)
      .then((raw) => { if (live) setRes({ key, raw, range }); })
      .catch((e) => { if (live) setRes((p) => ({ key, raw: p?.raw, range: p?.range, error: e instanceof Error ? e.message : "Could not load analytics." })); });
    return () => { live = false; };
  }, [range, key, customError, attempt]);
  // Keep showing the previous data (dimmed) while a new range loads; metrics always use the range the data was fetched for.
  const raw = res?.raw ?? null, dr = res?.range ?? range;
  const loading = !customError && (!res || res.key !== key), error = res && res.key === key ? res.error ?? null : null;
  const retry = () => { setRes((p) => ({ key: "", raw: p?.raw, range: p?.range })); setAttempt((n) => n + 1); };

  const fmt = (n: number) => money(n, currency), fmtC = (n: number) => compact(n, currency);
  const gran = granularityFor(dr.from, dr.to), buckets = useMemo(() => bucketList(dr.from, dr.to, gran), [dr, gran]);

  const prod = useMemo(() => raw && productivityStats(raw.tasksDue, raw.tasksDone, dr.from, dr.to, timezone), [raw, dr, timezone]);
  const habit = useMemo(() => raw && habitStats(raw.habits, raw.completions, dr.from, dr.to, today), [raw, dr, today]);
  const fin = useMemo(() => {
    if (!raw) return null;
    const inc = sumBy(raw.income, buckets, gran), exp = sumBy(raw.expenses, buckets, gran), totalIn = inc.reduce((a, b) => a + b, 0), totalOut = exp.reduce((a, b) => a + b, 0);
    let run = 0;
    const series = buckets.map((b, i) => { run += inc[i] - exp[i]; return { label: bucketLabel(b, gran), Income: inc[i], Expenses: exp[i], Savings: inc[i] - exp[i], Cumulative: run }; });
    const payments = buckets.map((b) => {
      const end = addDays(gran === "day" ? addDays(b, 1) : gran === "week" ? addDays(b, 7) : (() => { const d = new Date(`${b}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })(), -1);
      return raw.payments.filter((p) => p.payment_date > end).reduce((a, p) => a + p.amount, 0);
    });
    const remainingNow = raw.debts.reduce((a, d) => a + d.remaining_amount, 0);
    const debtSeries = buckets.map((b, i) => ({ label: bucketLabel(b, gran), Remaining: remainingNow + payments[i] }));
    const spentBy = new Map<string, number>(); raw.monthSpent.forEach((x) => spentBy.set(x.category, (spentBy.get(x.category) ?? 0) + x.amount));
    return { totalIn, totalOut, series, debtSeries, remainingNow, paid: raw.payments.reduce((a, p) => a + p.amount, 0),
      categories: foldTop(groupTotals(raw.expenses, (e) => e.category, (e) => e.amount)),
      budgets: raw.monthBudgets.map((b) => ({ name: b.category, budget: b.amount, spent: spentBy.get(b.category) ?? 0 })) };
  }, [raw, buckets, gran]);
  const goalsX = useMemo(() => {
    if (!raw) return null;
    const live = raw.goals.filter((g) => g.status !== "Cancelled");
    const openTasksByGoal = new Map<string, number>(); raw.openTasks.forEach((t) => t.goal_id && openTasksByGoal.set(t.goal_id, (openTasksByGoal.get(t.goal_id) ?? 0) + 1));
    const stages = HORIZONS_UP.map((h) => { const gs = live.filter((g) => g.goal_horizon === h); return { horizon: h, goals: gs, avg: gs.length ? gs.reduce((a, g) => a + g.progress_percentage, 0) / gs.length : 0, tasks: gs.reduce((a, g) => a + (openTasksByGoal.get(g.id) ?? 0), 0) }; });
    const withH = live.map((g) => ({ g, h: goalHealth(g, today) }));
    const msDone = raw.milestones.filter((m) => m.completed_at && localDay(m.completed_at, timezone) >= dr.from && localDay(m.completed_at, timezone) <= dr.to);
    const msSeries = sumBy(msDone.map((m) => ({ date: localDay(m.completed_at!, timezone), amount: 1 })), buckets, gran);
    return { stages, overdue: withH.filter((x) => x.h.state === "overdue"), soon: withH.filter((x) => x.h.state === "due-soon" || (x.h.days !== null && x.h.days <= 14 && x.h.days >= 0)),
      stale: live.filter((g) => isStale(g, today)), todayTasks: raw.openTasks.filter((t) => t.due_date === today).length,
      msDone: msDone.length, msTotal: raw.milestones.length, msSeries: buckets.map((b, i) => ({ label: bucketLabel(b, gran), Milestones: msSeries[i] })) };
  }, [raw, today, timezone, dr, buckets, gran]);

  const drill = useMemo(() => (raw && cat && fin ? rowsInBucket(raw.expenses, fin.categories, cat).sort((a, b) => b.amount - a.amount).slice(0, 8) : []), [raw, cat, fin]);
  const rangeText = `${shortDate(range.from)} – ${shortDate(range.to)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Tabs tabs={PRESETS} value={preset} onChange={setPreset} label="Date range" />
        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">From<input type="date" className="input" value={custom.from} max={today} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
            <label className="text-xs text-muted">To<input type="date" className="input" value={custom.to} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
          </div>
        )}
        <p className="ml-auto text-sm text-muted" aria-live="polite">{rangeText}</p>
      </div>
      {customError && <p role="alert" className="text-sm text-danger">{customError}</p>}
      <Tabs tabs={[{ id: "productivity", label: "Productivity" }, { id: "goals", label: "Goals" }, { id: "finance", label: "Finance" }, { id: "habits", label: "Habits" }] as { id: Section; label: string }[]} value={section} onChange={setSection} label="Analytics section" />

      {error && <div role="alert" className="rounded border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{error} <button className="ml-2 underline" onClick={retry}>Retry</button></div>}
      {loading && !raw && <div aria-busy="true" className="grid gap-3 md:grid-cols-2"><div className="skeleton h-64" /><div className="skeleton h-64" /></div>}
      <div className={loading && raw ? "opacity-60 transition-opacity" : ""} role="tabpanel" aria-busy={loading}>
        {raw && prod && section === "productivity" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Tasks completed" value={prod.completedCount} />
              <Stat label="Completion rate" value={`${Math.round(prod.completionPct)}%`} sub={`of ${prod.dueCount} tasks due in range`} />
              <Stat label="Overdue now" value={raw.openTasks.filter((t) => t.due_date && t.due_date < today).length} tone={raw.openTasks.some((t) => t.due_date && t.due_date < today) ? "danger" : undefined} />
              <Stat label="Avg task time" value={prod.avgMinutes === null ? "n/a" : `${Math.round(prod.avgMinutes)} min`} sub={prod.avgMinutes === null ? "Add estimates to see this" : "actual, else estimated"} />
            </div>
            <ChartCard title={`Completed vs due (${gran === "day" ? "daily" : gran === "week" ? "weekly" : "monthly"})`} table={tableOf(prod.series, "label", [{ key: "Completed" }, { key: "Due" }])}>
              <TrendChart data={prod.series} series={[{ key: "Completed" }, { key: "Due" }]} label="Tasks completed versus due over time" />
            </ChartCard>
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="By priority" table={{ head: ["Priority", "Tasks"], rows: prod.byPriority.map((p) => [p.name, p.value]) }}><HBars data={prod.byPriority} label="Tasks by priority" /></ChartCard>
              <ChartCard title="By category" table={{ head: ["Category", "Tasks"], rows: prod.byCategory.map((p) => [p.name, p.value]) }}>{prod.byCategory.length ? <HBars data={prod.byCategory.slice(0, 6)} label="Tasks by category" /> : <Empty>No tasks in this range.</Empty>}</ChartCard>
              <ChartCard title="Most productive days" subtitle={prod.bestDay.value ? `${prod.bestDay.name} leads with ${prod.bestDay.value} completed` : undefined} table={{ head: ["Day", "Completed"], rows: prod.weekdays.map((w) => [w.name, w.value]) }}>
                <TrendChart data={prod.weekdays.map((w) => ({ label: w.name, Completed: w.value }))} series={[{ key: "Completed" }]} height={180} label="Tasks completed by weekday" /></ChartCard>
            </div>
          </div>
        )}

        {raw && goalsX && section === "goals" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Overdue goals" value={goalsX.overdue.length} tone={goalsX.overdue.length ? "danger" : undefined} />
              <Stat label="Due within 14 days" value={goalsX.soon.length} />
              <Stat label="Stale (30+ days)" value={goalsX.stale.length} sub="In progress, not updated" />
              <Stat label="Milestones completed" value={goalsX.msDone} sub={`${goalsX.msTotal} milestones in total`} />
            </div>
            <Card title="How today's work connects to your long-term goals" >
              <p className="mb-3 text-xs text-muted">Click a stage to see its goals. Each stage shows average progress and open tasks linked to its goals.</p>
              <ol className="grid gap-2 md:grid-cols-7">
                <li className="rounded-lg border border-line p-2 text-sm"><p className="font-medium">Today</p><p className="text-xs text-muted">{goalsX.todayTasks} tasks due</p></li>
                {goalsX.stages.map((s) => (
                  <li key={s.horizon}><button onClick={() => setStage(stage === s.horizon ? null : s.horizon)} aria-pressed={stage === s.horizon}
                    className={`h-full w-full rounded-lg border p-2 text-left text-sm hover:border-accent ${stage === s.horizon ? "border-accent bg-accent/10" : "border-line"}`}>
                    <p className="font-medium"><span aria-hidden className="mr-1 text-muted">→</span>{s.horizon}</p><p className="text-xs text-muted">{s.goals.length} goals · {s.tasks} open tasks</p>
                    <ProgressBar value={s.avg} label={`${s.horizon} average progress`} className="mt-2" /><p className="mt-1 text-xs">{Math.round(s.avg)}%</p></button></li>))}
              </ol>
              {stage && <ul className="mt-3 space-y-1 text-sm">{(goalsX.stages.find((s) => s.horizon === stage)?.goals ?? []).map((g) => { const h = goalHealth(g, today); return <li key={g.id}><a className="underline" href={`/goals/${g.id}`}>{g.title}</a> <span className="text-muted">· {Math.round(g.progress_percentage)}%</span> {h.state === "overdue" && <Badge tone="danger">{healthLabel(h)}</Badge>}</li>; })}{!goalsX.stages.find((s) => s.horizon === stage)?.goals.length && <li className="text-muted">No goals at this horizon yet.</li>}</ul>}
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Goals by horizon" table={{ head: ["Horizon", "Goals"], rows: goalsX.stages.map((s) => [s.horizon, s.goals.length]) }}><HBars data={[...HORIZON_ORDER].reverse().map((h) => ({ name: h, value: goalsX.stages.find((s) => s.horizon === h)!.goals.length }))} label="Number of goals by horizon" /></ChartCard>
              <ChartCard title="Milestones completed" subtitle="Per period in the selected range" table={tableOf(goalsX.msSeries, "label", [{ key: "Milestones" }])}><TrendChart data={goalsX.msSeries} series={[{ key: "Milestones", color: "var(--c3)" }]} label="Milestones completed over time" /></ChartCard>
            </div>
            <Card title="Goals that need attention">
              {goalsX.overdue.length + goalsX.stale.length + goalsX.soon.length === 0 ? <Empty>Every goal is on track.</Empty> : (
                <ul className="space-y-1 text-sm">
                  {goalsX.overdue.map(({ g, h }) => <li key={g.id} className="row-overdue rounded bg-danger/5 p-2 pl-3"><a className="underline" href={`/goals/${g.id}`}>{g.title}</a> <Badge tone="danger">{healthLabel(h)}</Badge> <span className="text-muted">· {Math.round(g.progress_percentage)}% done</span></li>)}
                  {goalsX.soon.filter((x) => x.h.state !== "overdue").map(({ g, h }) => <li key={g.id} className="p-2"><a className="underline" href={`/goals/${g.id}`}>{g.title}</a> <Badge tone="warn">{healthLabel(h)}</Badge></li>)}
                  {goalsX.stale.map((g) => <li key={g.id} className="p-2"><a className="underline" href={`/goals/${g.id}`}>{g.title}</a> <Badge>No update in 30+ days</Badge></li>)}
                </ul>)}
            </Card>
          </div>
        )}

        {raw && fin && section === "finance" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Income" value={fmt(fin.totalIn)} /><Stat label="Expenses" value={fmt(fin.totalOut)} />
              <Stat label="Savings" value={fmt(savings(fin.totalIn, fin.totalOut))} /><Stat label="Savings rate" value={`${Math.round(savingsRate(fin.totalIn, fin.totalOut))}%`} />
              <Stat label="Debt remaining" value={fmt(fin.remainingNow)} sub={`${fmt(fin.paid)} paid in range`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Income vs expenses" table={tableOf(fin.series, "label", [{ key: "Income" }, { key: "Expenses" }], fmt)}><TrendChart data={fin.series} series={[{ key: "Income" }, { key: "Expenses" }]} format={fmtC} label="Income versus expenses over time" /></ChartCard>
              <ChartCard title="Cumulative savings" subtitle="Running total across the range" table={tableOf(fin.series, "label", [{ key: "Cumulative", name: "Saved so far" }], fmt)}><TrendChart data={fin.series} series={[{ key: "Cumulative", name: "Saved so far", color: "var(--c3)" }]} kind="area" format={fmtC} label="Cumulative savings over time" /></ChartCard>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Where the money went" subtitle="Click a category to see its largest expenses">
                {fin.categories.length === 0 ? <Empty>No expenses in this range.</Empty> : <Donut data={fin.categories} format={fmt} selected={cat} onSelect={setCat} label="Expenses by category" total={fmt(fin.totalOut)} />}
                {cat && <div className="mt-3 border-t border-line pt-2"><p className="text-sm font-medium">Largest in {cat}</p>
                  <ul className="mt-1 space-y-0.5 text-sm">{drill.map((e, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{e.title} <span className="text-muted">· {shortDate(e.date)}</span></span><span>{fmt(e.amount)}</span></li>)}</ul></div>}
              </ChartCard>
              <ChartCard title={`Budgets in ${monthLabel(monthStart(dr.to))}`} subtitle="Budget versus spent" table={tableOf(fin.budgets.map((b) => ({ label: b.name, Budget: b.budget, Spent: b.spent })), "label", [{ key: "Budget" }, { key: "Spent" }], fmt)}>
                {fin.budgets.length === 0 ? <Empty>No budgets set for that month.</Empty> : (<>
                  <TrendChart data={fin.budgets.map((b) => ({ label: b.name, Budget: b.budget, Spent: b.spent }))} series={[{ key: "Budget", color: "var(--c1)" }, { key: "Spent", color: "var(--c2)" }]} format={fmtC} height={200} label="Budget versus spent by category" />
                  <ul className="mt-2 space-y-1 text-sm">{fin.budgets.filter((b) => budgetStatus(budgetUsage(b.budget, b.spent)) !== "ok").map((b) => <li key={b.name}><Badge tone={b.spent >= b.budget ? "danger" : "warn"}>{b.name}: {Math.round(budgetUsage(b.budget, b.spent))}% used</Badge></li>)}</ul></>)}
              </ChartCard>
            </div>
            <ChartCard title="Debt remaining over time" subtitle="Reconstructed from your recorded payments" table={tableOf(fin.debtSeries, "label", [{ key: "Remaining" }], fmt)}>
              {raw.debts.length === 0 ? <Empty>No debts recorded.</Empty> : <TrendChart data={fin.debtSeries} series={[{ key: "Remaining", color: "var(--c8)" }]} kind="line" format={fmtC} label="Total debt remaining over time" />}
            </ChartCard>
          </div>
        )}

        {raw && habit && section === "habits" && (
          <div className="space-y-4">
            {raw.habits.length === 0 ? <Empty>No habits yet. Add a habit to see consistency, streaks and the heatmap.</Empty> : (<>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Completion rate" value={`${Math.round(habit.rate)}%`} sub={`over ${habit.days} days`} /><Stat label="Best current streak" value={`${habit.bestStreak} days`} />
                <Stat label="Longest streak in range" value={`${habit.longest} days`} /><Stat label="Active habits" value={raw.habits.length} />
              </div>
              <ChartCard title="Consistency" subtitle="Share of habit-days completed" table={tableOf(habit.series, "label", [{ key: "Consistency" }], (n) => `${n}%`)}><TrendChart data={habit.series} series={[{ key: "Consistency", color: "var(--c3)" }]} kind="area" format={(n) => `${n}%`} label="Habit consistency over time" /></ChartCard>
              <Card title="Heatmap"><Heatmap cells={habit.heat} /></Card>
              <Card title="Per habit"><ul className="space-y-3">{habit.per.map((h) => (
                <li key={h.id} className="text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{h.name}</span><span className="text-muted">{h.done}/{h.active} days · streak {h.current} · longest {h.longest}</span></div><ProgressBar value={h.rate} label={`${h.name} completion rate`} className="mt-1" /></li>))}</ul></Card></>)}
          </div>
        )}
      </div>
    </div>
  );
}
