"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { Badge, Card, Delta, Empty, Modal, ProgressBar, Stat, Tabs } from "@/components/ui";
import { ChartCard, Donut, TrendChart, tableOf } from "@/components/charts";
import { createClient } from "@/lib/supabase/client";
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, copyBudgets, createExpense, createIncome, deleteBudget, deleteExpense, deleteIncome, setBudget, updateExpense, updateIncome,
  type BudgetRow, type FinancePage,
} from "@/lib/services/finance";
import { foldTop, groupTotals, rowsInBucket } from "@/utils/analytics";
import { budgetRemaining, budgetStatus, budgetUsage, pctChange, projectedSpend, savings, savingsRate } from "@/utils/calc";
import { addMonths, daysInMonth, monthLabel, monthStart, shortDate, shortMonth } from "@/utils/dates";
import { compact, money } from "@/utils/format";

const PROJECTION_MIN_DAYS = 7; // earlier than this, one rent payment makes the projection meaningless
type Tab = "overview" | "transactions" | "budgets";
type Tx = { id: string; kind: "income" | "expense"; title: string; amount: number; date: string; category: string; method: string | null; recurring: boolean; notes: string | null };
type Editing = { kind: "income" | "expense"; tx?: Tx } | null;
type Sort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export default function FinanceView({ data, month }: { data: FinancePage; month: string }) {
  const router = useRouter();
  const { ctx, trend, prev } = data, currency = ctx.currency;
  const fmt = (n: number) => money(n, currency), fmtC = (n: number) => compact(n, currency);
  const [tab, setTab] = useState<Tab>("overview"), [error, setError] = useState<string | null>(null), [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null), [deleting, setDeleting] = useState<Tx | null>(null), [cat, setCat] = useState<string | null>(null);
  const [daily, setDaily] = useState<"daily" | "cumulative">("daily");
  const [q, setQ] = useState(""), [kind, setKind] = useState<"all" | "income" | "expense">("all"), [catFilter, setCatFilter] = useState("all"), [sort, setSort] = useState<Sort>("date-desc"), [limit, setLimit] = useState(20);
  const [budgetCat, setBudgetCat] = useState<string>(EXPENSE_CATEGORIES[0]);

  const isCurrent = month === monthStart(ctx.today), dim = daysInMonth(month), elapsed = isCurrent ? Number(ctx.today.slice(8)) : dim;
  const totalIn = data.income.reduce((a, r) => a + r.amount, 0), totalOut = data.expenses.reduce((a, r) => a + r.amount, 0);
  const net = savings(totalIn, totalOut), rate = savingsRate(totalIn, totalOut), prevLabel = shortMonth(addMonths(month, -1));
  const recurringOut = data.expenses.filter((e) => e.recurring).reduce((a, e) => a + e.amount, 0);
  const largest = data.expenses.reduce<typeof data.expenses[number] | null>((a, e) => (!a || e.amount > a.amount ? e : a), null);

  const txs = useMemo<Tx[]>(() => [
    ...data.income.map((r) => ({ id: r.id, kind: "income" as const, title: r.source, amount: r.amount, date: r.date, category: r.category ?? "Other", method: null, recurring: r.recurring, notes: r.notes })),
    ...data.expenses.map((r) => ({ id: r.id, kind: "expense" as const, title: r.title, amount: r.amount, date: r.date, category: r.category, method: r.payment_method, recurring: r.recurring, notes: r.notes })),
  ], [data.income, data.expenses]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return txs.filter((x) => (kind === "all" || x.kind === kind) && (catFilter === "all" || x.category === catFilter) && (!t || [x.title, x.category, x.notes ?? "", x.method ?? ""].join(" ").toLowerCase().includes(t)))
      .sort((a, b) => sort === "date-desc" ? b.date.localeCompare(a.date) : sort === "date-asc" ? a.date.localeCompare(b.date) : sort === "amount-desc" ? b.amount - a.amount : a.amount - b.amount);
  }, [txs, q, kind, catFilter, sort]);
  const fIn = filtered.filter((x) => x.kind === "income").reduce((a, x) => a + x.amount, 0), fOut = filtered.filter((x) => x.kind === "expense").reduce((a, x) => a + x.amount, 0);

  const categories = useMemo(() => foldTop(groupTotals(data.expenses, (e) => e.category, (e) => e.amount)), [data.expenses]);
  const dailyData = useMemo(() => {
    const by = new Map<string, number>(); data.expenses.forEach((e) => by.set(e.date, (by.get(e.date) ?? 0) + e.amount));
    const per = Array.from({ length: elapsed }, (_, i) => by.get(`${month.slice(0, 8)}${String(i + 1).padStart(2, "0")}`) ?? 0);
    const cum = per.reduce<number[]>((acc, v, i) => [...acc, (acc[i - 1] ?? 0) + v], []);
    return per.map((v, i) => ({ label: String(i + 1), Spent: v, Cumulative: cum[i] }));
  }, [data.expenses, month, elapsed]);
  const drill = useMemo(() => (cat ? rowsInBucket(data.expenses, categories, cat).sort((a, b) => b.amount - a.amount).slice(0, 8) : []), [cat, categories, data.expenses]);

  const spentBy = (c: string) => data.expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0);
  const budgetRows = data.budgets.map((b) => ({ ...b, spent: spentBy(b.category) }));
  const budgeted = new Set(data.budgets.map((b) => b.category));
  const unbudgeted = groupTotals(data.expenses, (e) => e.category, (e) => e.amount).filter((c) => !budgeted.has(c.name));
  const copyable = data.prevBudgets.filter((b) => !budgeted.has(b.category));
  const topCat = categories[0];

  const highlights: string[] = [];
  if (topCat && totalOut > 0) highlights.push(`${topCat.name} is your biggest expense at ${Math.round((topCat.value / totalOut) * 100)}% of spending (${fmt(topCat.value)}).`);
  const ch = pctChange(totalOut, prev.Expenses);
  if (ch !== null) highlights.push(`Spending is ${Math.abs(Math.round(ch))}% ${ch >= 0 ? "higher" : "lower"} than ${prevLabel}.`);
  budgetRows.filter((b) => budgetUsage(b.amount, b.spent) >= 80).forEach((b) => highlights.push(`${b.category} budget is ${Math.round(budgetUsage(b.amount, b.spent))}% used${b.spent > b.amount ? ` (${fmt(b.spent - b.amount)} over)` : ""}.`));
  if (isCurrent && totalOut > 0 && elapsed >= PROJECTION_MIN_DAYS) highlights.push(`At this pace you will spend about ${fmt(projectedSpend(totalOut, elapsed, dim))} by month end.`);

  async function run(fn: () => Promise<unknown>) { try { await fn(); setError(null); router.refresh(); return true; } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); return false; } }
  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!editing) return;
    const f = new FormData(e.currentTarget), db = createClient(), id = editing.tx?.id;
    const base = { amount: f.get("amount") ? Number(f.get("amount")) : NaN, date: String(f.get("date")), recurring: f.get("recurring") === "on", notes: String(f.get("notes") ?? "") };
    try {
      if (editing.kind === "expense") {
        const input = { ...base, title: String(f.get("title")), category: f.get("category") as (typeof EXPENSE_CATEGORIES)[number], payment_method: String(f.get("method") ?? "") };
        await (id ? updateExpense(db, id, input) : createExpense(db, input));
      } else {
        const input = { ...base, source: String(f.get("title")), category: f.get("category") as (typeof INCOME_CATEGORIES)[number] };
        await (id ? updateIncome(db, id, input) : createIncome(db, input));
      }
      setEditing(null); setFormError(null); router.refresh();
    } catch (err) { setFormError(err instanceof Error ? (err.name === "ZodError" ? JSON.parse(err.message)[0]?.message ?? "Check the form values." : err.message) : "Could not save."); }
  }
  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["Date,Type,Title,Category,Amount,Payment method,Recurring,Notes", ...filtered.map((x) => [x.date, x.kind, x.title, x.category, x.amount, x.method, x.recurring, x.notes].map(esc).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `transactions-${month.slice(0, 7)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  const openAdd = (k: "income" | "expense") => { setFormError(null); setEditing({ kind: k }); };
  const mq = (m: string) => `/finance?m=${m.slice(0, 7)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link href={mq(addMonths(month, -1))} aria-label="Previous month" className="rounded border border-line p-1.5 hover:border-accent"><ChevronLeft size={16} /></Link>
          <p className="min-w-36 text-center font-semibold" aria-live="polite">{monthLabel(month)}</p>
          <Link href={mq(addMonths(month, 1))} aria-label="Next month" className="rounded border border-line p-1.5 hover:border-accent"><ChevronRight size={16} /></Link>
          {!isCurrent && <Link href="/finance" className="ml-2 text-sm text-accent underline">This month</Link>}
        </div>
        <div className="flex gap-2"><button className="btn inline-flex items-center gap-1" onClick={() => openAdd("expense")}><Plus size={14} aria-hidden />Expense</button><button className="btn inline-flex items-center gap-1" onClick={() => openAdd("income")}><Plus size={14} aria-hidden />Income</button></div>
      </div>
      {error && <p role="alert" className="rounded border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Income" value={fmt(totalIn)} sub={<Delta value={pctChange(totalIn, prev.Income)} goodWhenUp label={prevLabel} />} />
        <Stat label="Expenses" value={fmt(totalOut)} sub={<Delta value={pctChange(totalOut, prev.Expenses)} goodWhenUp={false} label={prevLabel} />} />
        <Stat label="Savings" value={fmt(net)} tone={net < 0 ? "danger" : undefined} sub={net < 0 ? "Spending exceeds income" : <Delta value={pctChange(net, prev.Savings)} goodWhenUp label={prevLabel} />} />
        <Stat label="Savings rate" value={`${Math.round(rate)}%`} sub={totalIn ? `${fmt(net)} of ${fmt(totalIn)}` : "No income yet"} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Average per day" value={fmt(totalOut / Math.max(1, elapsed))} sub={`over ${elapsed} day${elapsed > 1 ? "s" : ""}`} />
        <Stat label={isCurrent ? "Projected month-end spend" : "Days in month"} value={isCurrent ? (elapsed >= PROJECTION_MIN_DAYS ? fmt(projectedSpend(totalOut, elapsed, dim)) : "Not yet") : dim} sub={isCurrent ? (elapsed >= PROJECTION_MIN_DAYS ? "At the current daily pace" : `Available after day ${PROJECTION_MIN_DAYS}`) : undefined} />
        <Stat label="Recurring expenses" value={fmt(recurringOut)} sub={`${data.expenses.filter((e) => e.recurring).length} marked recurring`} />
        <Stat label="Largest expense" value={largest ? fmt(largest.amount) : "—"} sub={largest?.title} />
      </div>

      <Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "transactions", label: "Transactions", count: txs.length }, { id: "budgets", label: "Budgets", count: data.budgets.length }] as { id: Tab; label: string; count?: number }[]} value={tab} onChange={setTab} label="Finance sections" />

      <div role="tabpanel" className="space-y-4">
        {tab === "overview" && (<>
          {highlights.length > 0 && <Card title="Highlights"><ul className="list-disc space-y-1 pl-5 text-sm">{highlights.map((h) => <li key={h}>{h}</li>)}</ul></Card>}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Income vs expenses" subtitle="Last 6 months" table={tableOf(trend, "label", [{ key: "Income" }, { key: "Expenses" }], fmt)}><TrendChart data={trend} series={[{ key: "Income" }, { key: "Expenses" }]} format={fmtC} label="Income versus expenses for six months" /></ChartCard>
            <ChartCard title="Savings trend" subtitle="Income minus expenses, last 6 months" table={tableOf(trend, "label", [{ key: "Savings" }], fmt)}><TrendChart data={trend} series={[{ key: "Savings", color: "var(--c3)" }]} kind="area" format={fmtC} label="Monthly savings for six months" /></ChartCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Where the money went" subtitle="Click a category to see its largest expenses">
              {categories.length === 0 ? <Empty>No expenses recorded yet this month.</Empty> : <Donut data={categories} format={fmt} selected={cat} onSelect={setCat} label="Expenses by category" total={fmt(totalOut)} />}
              {cat && <div className="mt-3 border-t border-line pt-2"><p className="text-sm font-medium">Largest in {cat}</p><ul className="mt-1 space-y-0.5 text-sm">{drill.map((e) => <li key={e.id} className="flex justify-between gap-2"><span className="truncate">{e.title} <span className="text-muted">· {shortDate(e.date)}</span></span><span>{fmt(e.amount)}</span></li>)}</ul></div>}
            </ChartCard>
            <ChartCard title="Spending through the month" table={tableOf(dailyData, "label", [{ key: daily === "daily" ? "Spent" : "Cumulative" }], fmt)}
              actions={<Tabs tabs={[{ id: "daily" as const, label: "Daily" }, { id: "cumulative" as const, label: "Cumulative" }]} value={daily} onChange={setDaily} label="Spending view" />}>
              <TrendChart data={dailyData} series={[daily === "daily" ? { key: "Spent", color: "var(--c2)" } : { key: "Cumulative", color: "var(--c2)" }]} kind={daily === "daily" ? "bar" : "area"} format={fmtC} label="Spending per day of the month" />
            </ChartCard>
          </div>
        </>)}

        {tab === "transactions" && (<>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">Search<input className="input w-44" value={q} onChange={(e) => { setQ(e.target.value); setLimit(20); }} placeholder="Title, note, method" /></label>
            <label className="text-xs text-muted">Type<select className="input" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setCatFilter("all"); setLimit(20); }}><option value="all">All</option><option value="expense">Expenses</option><option value="income">Income</option></select></label>
            <label className="text-xs text-muted">Category<select className="input" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setLimit(20); }}><option value="all">All</option>{[...new Set(txs.filter((t) => kind === "all" || t.kind === kind).map((t) => t.category))].sort().map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="text-xs text-muted">Sort<select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option><option value="amount-desc">Largest first</option><option value="amount-asc">Smallest first</option></select></label>
            <button className="btn inline-flex items-center gap-1" onClick={exportCsv} disabled={!filtered.length}><Download size={14} aria-hidden />Export CSV</button>
          </div>
          <p className="text-sm text-muted">{filtered.length} transaction{filtered.length === 1 ? "" : "s"} · in {fmt(fIn)} · out {fmt(fOut)}</p>
          {filtered.length === 0 ? <Empty>{txs.length === 0 ? "No transactions recorded this month. Use the Expense and Income buttons to add one." : "No transactions match these filters."}</Empty> : (<>
            <ul className="divide-y divide-line rounded-lg border border-line bg-panel">{filtered.slice(0, limit).map((x) => (
              <li key={`${x.kind}${x.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                <span className="w-16 text-muted">{shortDate(x.date)}</span>
                <span className="min-w-40 flex-1"><span className="font-medium">{x.title}</span> {x.recurring && <Badge><Repeat size={10} aria-hidden />Recurring</Badge>}
                  <span className="block text-xs text-muted">{x.category}{x.method ? ` · ${x.method}` : ""}{x.notes ? ` · ${x.notes}` : ""}</span></span>
                <span className={`font-semibold ${x.kind === "income" ? "text-accent" : ""}`}>{x.kind === "income" ? "+" : "−"}{fmt(x.amount)}</span>
                <button aria-label={`Edit ${x.title}`} className="p-1 text-muted hover:text-ink" onClick={() => { setFormError(null); setEditing({ kind: x.kind, tx: x }); }}><Pencil size={15} /></button>
                <button aria-label={`Delete ${x.title}`} className="p-1 text-muted hover:text-danger" onClick={() => setDeleting(x)}><Trash2 size={15} /></button>
              </li>))}</ul>
            {filtered.length > limit && <button className="btn" onClick={() => setLimit(limit + 20)}>Show more ({filtered.length - limit} left)</button>}</>)}
        </>)}

        {tab === "budgets" && (<>
          <Card title="Set a monthly budget" action={copyable.length > 0 ? <button className="rounded border border-line px-2 py-1 text-xs hover:border-accent" onClick={() => run(() => copyBudgets(createClient(), copyable, month))}>Copy {copyable.length} from {prevLabel}</button> : undefined}>
            <form className="flex flex-wrap items-end gap-2" key={budgetCat} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await run(() => setBudget(createClient(), month, { category: budgetCat as (typeof EXPENSE_CATEGORIES)[number], amount: f.get("amount") ? Number(f.get("amount")) : NaN })); }}>
              <label className="text-xs text-muted">Category<select className="input" value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="text-xs text-muted">Monthly limit<input name="amount" type="number" min="0.01" step="0.01" className="input w-36" defaultValue={data.budgets.find((b) => b.category === budgetCat)?.amount} required /></label>
              <button className="btn">{budgeted.has(budgetCat) ? "Update budget" : "Save budget"}</button>
            </form>
          </Card>
          {budgetRows.length === 0 ? <Empty>No budgets for {monthLabel(month)}. Set one above{data.prevBudgets.length ? `, or copy last month's` : ""}.</Empty> : (<>
            <ChartCard title="Budget vs spent" table={tableOf(budgetRows.map((b) => ({ label: b.category, Budget: b.amount, Spent: b.spent })), "label", [{ key: "Budget" }, { key: "Spent" }], fmt)}>
              <TrendChart data={budgetRows.map((b) => ({ label: b.category, Budget: b.amount, Spent: b.spent }))} series={[{ key: "Budget", color: "var(--c1)" }, { key: "Spent", color: "var(--c2)" }]} format={fmtC} label="Budget versus spent by category" />
            </ChartCard>
            <ul className="grid gap-3 sm:grid-cols-2">{budgetRows.map((b: BudgetRow & { spent: number }) => { const u = budgetUsage(b.amount, b.spent), s = budgetStatus(u); return (
              <li key={b.id} className={`rounded-lg border p-3 ${s === "over" ? "row-overdue border-danger/50 bg-danger/5" : "border-line bg-panel"}`}>
                <div className="flex items-start justify-between gap-2"><span className="font-semibold">{b.category}</span>
                  <span className="flex gap-1"><button aria-label={`Edit ${b.category} budget`} className="p-1 text-muted hover:text-ink" onClick={() => setBudgetCat(b.category)}><Pencil size={14} /></button>
                    <button aria-label={`Delete ${b.category} budget`} className="p-1 text-muted hover:text-danger" onClick={() => run(() => deleteBudget(createClient(), b.id))}><Trash2 size={14} /></button></span></div>
                <p className="text-sm text-muted">{fmt(b.spent)} of {fmt(b.amount)} · {budgetRemaining(b.amount, b.spent) >= 0 ? `${fmt(budgetRemaining(b.amount, b.spent))} left` : `${fmt(-budgetRemaining(b.amount, b.spent))} over`}</p>
                <ProgressBar value={u} label={`${b.category} budget used`} tone={s === "ok" ? "ok" : s === "over" ? "danger" : "warn"} className="my-2" />
                <Badge tone={s === "ok" ? "ok" : s === "over" ? "danger" : "warn"}>{Math.round(u)}% · {s === "ok" ? "On track" : s === "over" ? "Over budget" : s === "critical" ? "Over 90% used" : "Over 80% used"}</Badge>
              </li>); })}</ul></>)}
          {unbudgeted.length > 0 && <Card title="Spending without a budget"><ul className="space-y-1 text-sm">{unbudgeted.map((c) => <li key={c.name} className="flex items-center justify-between gap-2"><span>{c.name} · {fmt(c.value)}</span><button className="text-xs text-accent underline" onClick={() => { setBudgetCat(c.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Set budget</button></li>)}</ul></Card>}
        </>)}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`${editing?.tx ? "Edit" : "Add"} ${editing?.kind ?? ""}`}>
        {editing && (
          <form onSubmit={onSave} className="grid gap-2 sm:grid-cols-2" key={`${editing.kind}-${editing.tx?.id ?? "new"}`}>
            <label className="text-xs text-muted sm:col-span-2">{editing.kind === "income" ? "Source" : "Title"}<input name="title" className="input" defaultValue={editing.tx?.title} required autoFocus /></label>
            <label className="text-xs text-muted">Amount<input name="amount" type="number" min="0.01" step="0.01" className="input" defaultValue={editing.tx?.amount} required /></label>
            <label className="text-xs text-muted">Date<input name="date" type="date" className="input" defaultValue={editing.tx?.date ?? (month === monthStart(ctx.today) ? ctx.today : month)} required /></label>
            <label className="text-xs text-muted">Category<select name="category" className="input" defaultValue={editing.tx?.category ?? "Other"}>{(editing.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c}>{c}</option>)}</select></label>
            {editing.kind === "expense" && <label className="text-xs text-muted">Payment method<select name="method" className="input" defaultValue={editing.tx?.method ?? ""}><option value="">Not set</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>}
            <label className="text-xs text-muted sm:col-span-2">Notes<textarea name="notes" rows={2} className="input" defaultValue={editing.tx?.notes ?? ""} /></label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="recurring" defaultChecked={editing.tx?.recurring} /> Repeats every month</label>
            {formError && <p role="alert" className="text-sm text-danger sm:col-span-2">{formError}</p>}
            <div className="flex gap-2 sm:col-span-2"><button className="btn">Save</button><button type="button" className="rounded-md border border-line px-3" onClick={() => setEditing(null)}>Cancel</button></div>
          </form>)}
      </Modal>
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete transaction?">
        {deleting && (<div className="space-y-3"><p className="text-sm">“{deleting.title}” ({fmt(deleting.amount)}, {shortDate(deleting.date)}) will be removed permanently.</p>
          <div className="flex gap-2"><button className="btn bg-danger" onClick={async () => { const t = deleting; setDeleting(null); await run(() => (t.kind === "income" ? deleteIncome : deleteExpense)(createClient(), t.id)); }}>Delete</button><button className="rounded-md border border-line px-3" onClick={() => setDeleting(null)}>Cancel</button></div></div>)}
      </Modal>
    </div>
  );
}
