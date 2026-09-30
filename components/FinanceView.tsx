"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EXPENSE_CATEGORIES, createExpense, createIncome, deleteBudget, deleteExpense, deleteIncome, setBudget,
  type BudgetRow, type ExpenseRow, type IncomeRow,
} from "@/lib/services/finance";
import { budgetRemaining, budgetStatus, budgetUsage, savings, savingsRate } from "@/utils/calc";

type Props = { income: IncomeRow[]; expenses: ExpenseRow[]; budgets: BudgetRow[]; currency: string; monthStart: string; monthLabel: string };
const statusText = { ok: "On track", warning: "Over 80% used", critical: "Over 90% used", over: "Over budget" } as const;
const sum = (r: { amount: number }[]) => r.reduce((a, b) => a + b.amount, 0);

export default function FinanceView({ income, expenses, budgets, currency, monthStart, monthLabel }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"expense" | "income" | "budget">("expense");
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  const totalIn = sum(income), totalOut = sum(expenses);
  const spentBy = (c: string) => sum(expenses.filter((e) => e.category === c));
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({ c, v: spentBy(c) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const today = new Date().toISOString().slice(0, 10);
  const tx = [...income.map((i) => ({ ...i, label: i.source, kind: "income" as const })), ...expenses.map((e) => ({ ...e, label: `${e.title} (${e.category})`, kind: "expense" as const }))]
    .sort((a, b) => b.date.localeCompare(a.date));

  async function run(fn: () => Promise<unknown>, form?: HTMLFormElement) {
    try { await fn(); setError(null); form?.reset(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form), db = createClient();
    const amt = f.get("amount") ? Number(f.get("amount")) : NaN;
    if (tab === "expense") run(() => createExpense(db, { title: String(f.get("name")), amount: amt, date: String(f.get("date")), category: f.get("category") as (typeof EXPENSE_CATEGORIES)[number] }), form);
    else if (tab === "income") run(() => createIncome(db, { source: String(f.get("name")), amount: amt, date: String(f.get("date")) }), form);
    else run(() => setBudget(db, monthStart, { category: f.get("category") as (typeof EXPENSE_CATEGORIES)[number], amount: amt }), form);
  }
  const card = (label: string, value: string) => (
    <div className="bg-panel border border-line rounded-lg p-4"><p className="text-xs text-muted">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{monthLabel}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {card("Income", money(totalIn))}{card("Expenses", money(totalOut))}
        {card("Savings", money(savings(totalIn, totalOut)))}{card("Savings rate", `${savingsRate(totalIn, totalOut).toFixed(0)}%`)}
      </div>

      <section className="bg-panel border border-line rounded-lg p-3 space-y-3" aria-label="Add entry">
        <div className="flex gap-2 text-sm" role="group" aria-label="Entry type">
          {(["expense", "income", "budget"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 border border-line ${tab === t ? "bg-accent text-accent-ink" : ""}`}>{t === "budget" ? "Set budget" : `Add ${t}`}</button>
          ))}
        </div>
        <form onSubmit={onSubmit} key={tab} className="flex flex-wrap gap-2">
          {tab !== "budget" && <label className="flex-1 min-w-40"><span className="sr-only">{tab === "income" ? "Source" : "Title"}</span><input name="name" className="input" placeholder={tab === "income" ? "Source, e.g. Salary" : "What was it for?"} required /></label>}
          {tab !== "income" && <label><span className="sr-only">Category</span><select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>}
          <label><span className="sr-only">Amount</span><input name="amount" type="number" min="0.01" step="0.01" className="input w-32" placeholder={tab === "budget" ? "Monthly limit" : "Amount"} required /></label>
          {tab !== "budget" && <label><span className="sr-only">Date</span><input name="date" type="date" className="input" defaultValue={today} required /></label>}
          <button className="btn">Save</button>
        </form>
      </section>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <section aria-labelledby="bd" className="space-y-2">
        <h2 id="bd" className="font-semibold">Budgets</h2>
        {budgets.length === 0 ? <p className="text-sm text-muted">No budgets for this month. Use “Set budget” to add one.</p> : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {budgets.map((b) => {
              const spent = spentBy(b.category), use = budgetUsage(b.amount, spent), st = budgetStatus(use);
              return (
                <li key={b.id} className="bg-panel border border-line rounded-lg p-3">
                  <div className="flex justify-between"><span className="font-semibold">{b.category}</span>
                    <button className="text-xs text-muted hover:text-danger" onClick={() => confirm(`Delete ${b.category} budget?`) && run(() => deleteBudget(createClient(), b.id))}>Delete</button></div>
                  <p className="text-sm text-muted">{money(spent)} of {money(b.amount)} · {money(budgetRemaining(b.amount, spent))} left</p>
                  <div role="progressbar" aria-valuenow={Math.min(100, Math.round(use))} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.category} budget used`} className="h-2 rounded bg-line mt-2">
                    <div className={`h-2 rounded ${st === "ok" ? "bg-accent" : "bg-danger"}`} style={{ width: `${Math.min(100, use)}%` }} /></div>
                  <p className={`text-xs mt-1 ${st === "ok" ? "text-muted" : "text-danger font-semibold"}`}>{Math.round(use)}% · {statusText[st]}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {byCategory.length > 0 && (
        <section aria-labelledby="ec" className="space-y-2"><h2 id="ec" className="font-semibold">Spending by category</h2>
          <ul className="space-y-1 text-sm">{byCategory.map(({ c, v }) => (
            <li key={c} className="flex items-center gap-2"><span className="w-28">{c}</span>
              <div className="flex-1 h-2 rounded bg-line"><div className="h-2 rounded bg-accent" style={{ width: `${(v / byCategory[0].v) * 100}%` }} /></div>
              <span className="w-28 text-right">{money(v)}</span></li>))}</ul></section>
      )}

      <section aria-labelledby="tr" className="space-y-2"><h2 id="tr" className="font-semibold">Transactions</h2>
        {tx.length === 0 ? <p className="text-sm text-muted">No transactions recorded this month.</p> : (
          <ul className="divide-y divide-line bg-panel border border-line rounded-lg">
            {tx.map((t) => (
              <li key={`${t.kind}${t.id}`} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-20 text-muted">{t.date}</span><span className="flex-1 min-w-0 truncate">{t.label}</span>
                <span className={t.kind === "income" ? "text-accent font-semibold" : ""}>{t.kind === "income" ? "+" : "−"}{money(t.amount)}</span>
                <button aria-label={`Delete ${t.label}`} className="text-xs text-muted hover:text-danger"
                  onClick={() => confirm(`Delete "${t.label}"?`) && run(() => (t.kind === "income" ? deleteIncome : deleteExpense)(createClient(), t.id))}>Delete</button>
              </li>))}
          </ul>)}
      </section>
    </div>
  );
}
