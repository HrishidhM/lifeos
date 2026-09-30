"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, HORIZONS, buildTree, createGoal, type Goal } from "@/lib/services/goals";

type Node = ReturnType<typeof buildTree>[number];

function Bar({ pct }: { pct: number }) {
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress" className="h-1.5 w-24 rounded bg-line">
      <div className="h-1.5 rounded bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}
function Tree({ nodes, depth = 0 }: { nodes: Node[]; depth?: number }) {
  return (
    <ul className={depth ? "ml-5 border-l border-line pl-3" : "space-y-2"}>
      {nodes.map((n) => (
        <li key={n.id} className="mt-2">
          <Link href={`/goals/${n.id}`} className="flex flex-wrap items-center gap-3 bg-panel border border-line rounded-lg p-3 hover:border-accent">
            <span className="font-semibold flex-1 min-w-40">{n.title}</span>
            <span className="text-xs text-muted">{n.goal_horizon} · {n.category} · {n.status}</span>
            <Bar pct={n.progress_percentage} />
            <span className="text-xs w-9 text-right">{Math.round(n.progress_percentage)}%</span>
          </Link>
          {n.children.length > 0 && <Tree nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default function GoalsView({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : undefined);
    try {
      await createGoal(createClient(), {
        title: String(f.get("title")), goal_horizon: f.get("goal_horizon") as (typeof HORIZONS)[number],
        category: f.get("category") as (typeof CATEGORIES)[number], priority: "Medium", status: "Not Started",
        target_date: (f.get("target_date") as string) || undefined, parent_goal_id: (f.get("parent") as string) || null,
        target_value: num("target_value"), current_value: num("target_value") ? 0 : undefined, unit: (f.get("unit") as string) || undefined,
      });
      form.reset(); setError(null); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create goal."); }
  }
  return (
    <>
      <form onSubmit={onAdd} className="grid gap-2 sm:grid-cols-3 bg-panel border border-line rounded-lg p-3">
        <label className="sm:col-span-3"><span className="sr-only">Title</span><input name="title" className="input" placeholder="New goal, e.g. Build an AI product" required /></label>
        <label className="text-xs text-muted">Horizon<select name="goal_horizon" className="input" defaultValue="Short-Term">{HORIZONS.map((h) => <option key={h}>{h}</option>)}</select></label>
        <label className="text-xs text-muted">Category<select name="category" className="input" defaultValue="Other">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-xs text-muted">Parent goal<select name="parent" className="input" defaultValue=""><option value="">None</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.goal_horizon}: {g.title}</option>)}</select></label>
        <label className="text-xs text-muted">Target date<input name="target_date" type="date" className="input" /></label>
        <label className="text-xs text-muted">Target value (optional)<input name="target_value" type="number" min="0" step="any" className="input" /></label>
        <label className="text-xs text-muted">Unit<input name="unit" className="input" placeholder="books, ₹, kg" /></label>
        <button className="btn sm:col-span-3">Add goal</button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {goals.length === 0 ? <p className="text-muted text-sm">No goals yet. Start with a 10-Year or 5-Year goal, then add smaller goals under it.</p> : <Tree nodes={buildTree(goals)} />}
    </>
  );
}
