"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Moon, Plus, Search, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createTask } from "@/lib/services/tasks";
import { createExpense, createIncome } from "@/lib/services/finance";
import { createNote } from "@/lib/services/notes";

type Hit = { group: string; label: string; href: string };

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title} className="m-auto w-[min(32rem,92vw)] rounded-lg border border-line bg-panel p-4 text-ink backdrop:bg-black/50">
      <h2 className="mb-3 font-semibold">{title}</h2>{open && children}
    </dialog>
  );
}

const subscribeTheme = (cb: () => void) => { addEventListener("themechange", cb); return () => removeEventListener("themechange", cb); };
const themeIsDark = () => { try { const t = localStorage.getItem("theme"); if (t) return t === "dark"; } catch { /* storage blocked */ } return matchMedia("(prefers-color-scheme: dark)").matches; };

export default function Topbar() {
  const router = useRouter();
  const dark = useSyncExternalStore(subscribeTheme, themeIsDark, () => false);
  const [adding, setAdding] = useState(false), [searching, setSearching] = useState(false);
  const [kind, setKind] = useState("Task"), [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(""), [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearching(true); } };
    addEventListener("keydown", key); return () => removeEventListener("keydown", key);
  }, []);
  function toggleTheme() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* storage blocked */ }
    dispatchEvent(new Event("themechange"));
  }
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      const db = createClient(), p = `%${q.trim()}%`;
      const [a, b, c, d] = await Promise.all([
        db.from("tasks").select("id,title").ilike("title", p).limit(5), db.from("goals").select("id,title").ilike("title", p).limit(5),
        db.from("notes").select("id,title").ilike("title", p).limit(5), db.from("shopping_items").select("id,item").ilike("item", p).limit(5),
      ]);
      setHits([
        ...(a.data ?? []).map((x) => ({ group: "Tasks", label: x.title, href: "/tasks" })),
        ...(b.data ?? []).map((x) => ({ group: "Goals", label: x.title, href: `/goals/${x.id}` })),
        ...(c.data ?? []).map((x) => ({ group: "Notes", label: x.title, href: "/notes" })),
        ...(d.data ?? []).map((x) => ({ group: "Shopping", label: x.item, href: "/shopping" })),
      ]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), db = createClient(), title = String(f.get("title")), date = String(f.get("date") || new Date().toLocaleDateString("en-CA"));
    const amount = f.get("amount") ? Number(f.get("amount")) : NaN;
    try {
      if (kind === "Task") await createTask(db, { title, priority: "Medium", status: "Todo", due_date: (f.get("date") as string) || undefined });
      else if (kind === "Expense") await createExpense(db, { title, amount, date, category: "Other" });
      else if (kind === "Income") await createIncome(db, { source: title, amount, date });
      else await createNote(db, { title, content: "", tags: [] });
      setError(null); setAdding(false); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save."); }
  }
  const results = q.trim().length >= 2 ? hits : [];
  const btn = "flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-1.5 text-sm";
  return (
    <div className="mb-4 flex justify-end gap-2">
      <button className={btn} onClick={() => setSearching(true)}><Search size={14} aria-hidden /> Search <kbd className="text-xs text-muted">Ctrl K</kbd></button>
      <button className={btn} onClick={() => { setError(null); setAdding(true); }}><Plus size={14} aria-hidden /> Quick add</button>
      <button className={btn} onClick={toggleTheme} aria-label="Toggle dark mode">{dark ? <Sun size={14} /> : <Moon size={14} />}</button>

      <Modal open={adding} onClose={() => setAdding(false)} title="Quick add">
        <form onSubmit={onAdd} className="space-y-2">
          <label className="block text-sm">Type<select value={kind} onChange={(e) => setKind(e.target.value)} className="input mt-1">{["Task", "Expense", "Income", "Note"].map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="block text-sm">{kind === "Income" ? "Source" : "Title"}<input name="title" className="input mt-1" required autoFocus /></label>
          {(kind === "Expense" || kind === "Income") && <label className="block text-sm">Amount<input name="amount" type="number" min="0.01" step="0.01" className="input mt-1" required /></label>}
          {kind !== "Note" && <label className="block text-sm">{kind === "Task" ? "Due date" : "Date"}<input name="date" type="date" className="input mt-1" /></label>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2"><button className="btn">Save</button><button type="button" className="rounded-md border border-line px-3" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>
      </Modal>
      <Modal open={searching} onClose={() => { setSearching(false); setQ(""); }} title="Search">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Search tasks, goals, notes, shopping…" aria-label="Search" autoFocus />
        <div className="mt-3 max-h-72 overflow-y-auto text-sm">
          {q.trim().length >= 2 && results.length === 0 && <p className="text-muted">No results.</p>}
          {["Tasks", "Goals", "Notes", "Shopping"].map((g) => results.some((h) => h.group === g) && (
            <div key={g} className="mb-2"><p className="text-xs text-muted">{g}</p>
              {results.filter((h) => h.group === g).map((h, i) => <button key={i} className="block w-full rounded px-2 py-1 text-left hover:bg-line" onClick={() => { setSearching(false); setQ(""); router.push(h.href); }}>{h.label}</button>)}</div>))}
        </div>
      </Modal>
    </div>
  );
}
