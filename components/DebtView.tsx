"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createDebt, deleteDebt, recordPayment, type Debt, type Payment } from "@/lib/services/debt";
import { completionPct } from "@/utils/calc";

export default function DebtView({ debts, payments, currency }: { debts: Debt[]; payments: Payment[]; currency: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  const live = debts.filter((d) => d.status !== "Cancelled");
  const original = live.reduce((a, d) => a + d.original_amount, 0);
  const remaining = live.reduce((a, d) => a + d.remaining_amount, 0);
  const active = debts.filter((d) => d.status === "Active");
  const upcoming = active.filter((d) => d.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).slice(0, 5);
  const name = (id: string) => debts.find((d) => d.id === id)?.creditor ?? "Deleted debt";

  async function run(fn: () => Promise<unknown>, form?: HTMLFormElement) {
    try { await fn(); setError(null); form?.reset(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }
  const opt = (v: FormDataEntryValue | null) => (v ? Number(v) : undefined);
  const card = (l: string, v: string) => <div className="bg-panel border border-line rounded-lg p-4"><p className="text-xs text-muted">{l}</p><p className="text-xl font-bold mt-1">{v}</p></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {card("Total debt", money(original))}{card("Total paid", money(original - remaining))}
        {card("Remaining", money(remaining))}{card("Active debts", String(active.length))}
      </div>

      <form className="grid gap-2 sm:grid-cols-3 bg-panel border border-line rounded-lg p-3" onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
        run(() => createDebt(createClient(), {
          creditor: String(f.get("creditor")), original_amount: Number(f.get("amount")), interest_rate: opt(f.get("rate")) ?? 0,
          minimum_payment: opt(f.get("min")), due_date: (f.get("due") as string) || undefined,
        }), form);
      }}>
        <label className="sm:col-span-3"><span className="sr-only">Creditor</span><input name="creditor" className="input" placeholder="Who do you owe? e.g. Bank loan" required /></label>
        <label className="text-xs text-muted">Amount owed<input name="amount" type="number" min="0.01" step="0.01" className="input" required /></label>
        <label className="text-xs text-muted">Interest rate %<input name="rate" type="number" min="0" max="100" step="0.01" className="input" /></label>
        <label className="text-xs text-muted">Minimum payment<input name="min" type="number" min="0" step="0.01" className="input" /></label>
        <label className="text-xs text-muted">Next due date<input name="due" type="date" className="input" /></label>
        <button className="btn sm:col-span-3">Add debt</button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {upcoming.length > 0 && (
        <section aria-labelledby="up"><h2 id="up" className="font-semibold mb-2">Upcoming payments</h2>
          <ul className="text-sm space-y-1">{upcoming.map((d) => (
            <li key={d.id}>{d.due_date}{d.due_date! < today ? " (overdue)" : ""} · {d.creditor} · {d.minimum_payment ? `min ${money(d.minimum_payment)}` : `${money(d.remaining_amount)} left`}</li>))}</ul></section>
      )}

      <section aria-labelledby="dl" className="space-y-2"><h2 id="dl" className="font-semibold">Debts</h2>
        {debts.length === 0 ? <p className="text-sm text-muted">No debts recorded. Add one above to start tracking payoff.</p> : (
          <ul className="space-y-3">{debts.map((d) => {
            const pct = Math.round(completionPct(d.original_amount - d.remaining_amount, d.original_amount));
            return (
              <li key={d.id} className="bg-panel border border-line rounded-lg p-4 space-y-2">
                <div className="flex justify-between gap-2"><span className="font-semibold">{d.creditor} <span className="text-xs text-muted">· {d.status}{d.interest_rate ? ` · ${d.interest_rate}%` : ""}</span></span>
                  <button className="text-xs text-muted hover:text-danger" onClick={() => confirm(`Delete debt "${d.creditor}" and its payment history?`) && run(() => deleteDebt(createClient(), d.id))}>Delete</button></div>
                <p className="text-sm text-muted">{money(d.remaining_amount)} remaining of {money(d.original_amount)} · {pct}% paid{d.due_date ? ` · due ${d.due_date}` : ""}</p>
                <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${d.creditor} paid off`} className="h-2 rounded bg-line"><div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} /></div>
                {d.status === "Paid" ? <p className="text-sm text-accent font-semibold">Paid off</p> : (
                  <form className="flex flex-wrap gap-2" onSubmit={(e) => {
                    e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
                    run(() => recordPayment(createClient(), d, Number(f.get("amt")), String(f.get("date"))), form);
                  }}>
                    <label><span className="sr-only">Payment amount</span><input name="amt" type="number" min="0.01" max={d.remaining_amount} step="0.01" className="input w-32" placeholder="Payment" required /></label>
                    <label><span className="sr-only">Payment date</span><input name="date" type="date" defaultValue={today} className="input" required /></label>
                    <button className="btn">Record payment</button>
                  </form>)}
              </li>);
          })}</ul>)}
      </section>

      <section aria-labelledby="ph"><h2 id="ph" className="font-semibold mb-2">Payment history</h2>
        {payments.length === 0 ? <p className="text-sm text-muted">No payments recorded yet.</p> : (
          <ul className="divide-y divide-line bg-panel border border-line rounded-lg text-sm">{payments.map((p) => (
            <li key={p.id} className="flex gap-3 p-3"><span className="w-24 text-muted">{p.payment_date}</span><span className="flex-1">{name(p.debt_id)}</span><span className="font-semibold">{money(p.amount)}</span></li>))}</ul>)}
      </section>
    </div>
  );
}
