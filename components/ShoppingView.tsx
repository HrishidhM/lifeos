"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, createItem, deleteItem, setStatus, type Item } from "@/lib/services/shopping";

const order = { Critical: 0, High: 1, Medium: 2, Low: 3 } as Record<string, number>;

export default function ShoppingView({ items, currency }: { items: Item[]; currency: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [q, setQ] = useState("");
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  const today = new Date().toLocaleDateString("en-CA");
  const open = items.filter((i) => !["Purchased", "Cancelled"].includes(i.status));
  const planned = open.reduce((a, i) => a + (i.estimated_price ?? 0), 0);
  const bought = items.filter((i) => i.status === "Purchased").reduce((a, i) => a + (i.actual_price ?? i.estimated_price ?? 0), 0);
  const high = open.filter((i) => ["High", "Critical"].includes(i.priority)).length;
  const shown = items.filter((i) => (filter === "All" || i.status === filter) && i.item.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => order[a.priority] - order[b.priority]);

  async function run(fn: () => Promise<unknown>, form?: HTMLFormElement) {
    try { await fn(); setError(null); form?.reset(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }
  const card = (l: string, v: string) => <div className="bg-panel border border-line rounded-lg p-4"><p className="text-xs text-muted">{l}</p><p className="text-xl font-bold mt-1">{v}</p></div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">{card("Planned cost", money(planned))}{card("Purchased", money(bought))}{card("High priority", String(high))}</div>
      <form className="grid gap-2 sm:grid-cols-4 bg-panel border border-line rounded-lg p-3" onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
        run(() => createItem(createClient(), {
          item: String(f.get("item")), estimated_price: f.get("price") ? Number(f.get("price")) : undefined,
          priority: f.get("priority") as "Low", planned_date: (f.get("date") as string) || undefined, purchase_url: (f.get("url") as string) || undefined,
        }), form);
      }}>
        <label className="sm:col-span-4"><span className="sr-only">Item</span><input name="item" className="input" placeholder="What do you want to buy?" required /></label>
        <label className="text-xs text-muted">Estimated price<input name="price" type="number" min="0" step="0.01" className="input" /></label>
        <label className="text-xs text-muted">Priority<select name="priority" defaultValue="Medium" className="input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
        <label className="text-xs text-muted">Planned date<input name="date" type="date" className="input" /></label>
        <label className="text-xs text-muted">Link<input name="url" type="url" placeholder="https://" className="input" /></label>
        <button className="btn sm:col-span-4">Add item</button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <label><span className="sr-only">Search</span><input value={q} onChange={(e) => setQ(e.target.value)} className="input w-48" placeholder="Search items" /></label>
        {["All", ...STATUSES].map((s) => <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)} className={`rounded-md px-2 py-1 border border-line ${filter === s ? "bg-accent text-accent-ink" : "bg-panel"}`}>{s}</button>)}
      </div>
      {shown.length === 0 ? <p className="text-sm text-muted">{items.length === 0 ? "No planned purchases yet." : "No items match."}</p> : (
        <ul className="divide-y divide-line bg-panel border border-line rounded-lg">{shown.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="flex-1 min-w-40">
              <p className={i.status === "Cancelled" ? "line-through text-muted" : "font-semibold"}>{i.purchase_url ? <a className="underline" href={i.purchase_url} target="_blank" rel="noopener noreferrer">{i.item}</a> : i.item}</p>
              <p className="text-xs text-muted">{i.priority}{i.planned_date ? ` · ${i.planned_date}${i.planned_date < today && i.status !== "Purchased" ? " (past due)" : ""}` : ""}
                {` · est ${i.estimated_price == null ? "—" : money(i.estimated_price)}`}{i.actual_price != null ? ` · paid ${money(i.actual_price)}` : ""}</p>
            </div>
            <label><span className="sr-only">Status of {i.item}</span>
              <select className="input" value={i.status} onChange={(e) => {
                const s = e.target.value as (typeof STATUSES)[number];
                let paid: number | undefined;
                if (s === "Purchased") { const a = prompt("Actual price paid?", String(i.estimated_price ?? "")); if (a === null) return; paid = Number(a); }
                run(() => setStatus(createClient(), i, s, paid));
              }}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <button className="text-xs text-muted hover:text-danger" onClick={() => confirm(`Delete "${i.item}"?`) && run(() => deleteItem(createClient(), i.id))}>Delete</button>
          </li>))}</ul>)}
    </div>
  );
}
