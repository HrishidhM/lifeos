"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Card, Empty, ProgressBar, Stat, Tabs } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, HORIZONS, buildTree, createGoal, type Goal } from "@/lib/services/goals";
import { diffDays, shortDate } from "@/utils/dates";
import { goalHealth, healthLabel, isStale, type Health } from "@/utils/goals";

type Node = ReturnType<typeof buildTree>[number];
type Ms = { goal_id: string; status: string; target_date: string | null };
type Filter = "all" | "overdue" | "soon" | "active" | "done";
type View = "tree" | "timeline";
const tone = (h: Health) => (h.state === "overdue" ? "danger" : h.state === "due-soon" ? "warn" : h.state === "done" ? "ok" : "muted");

function Row({ g, today, miles }: { g: Goal; today: string; miles: Ms[] }) {
  const h = goalHealth(g, today), mine = miles.filter((m) => m.goal_id === g.id);
  const done = mine.filter((m) => m.status === "Completed").length, lateMs = mine.filter((m) => m.status !== "Completed" && m.target_date && m.target_date < today).length;
  return (
    <Link href={`/goals/${g.id}`} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line p-3 hover:border-accent ${h.state === "overdue" ? "row-overdue bg-danger/5" : "bg-panel"}`}>
      <span className="min-w-40 flex-1 font-semibold">{g.title}</span>
      <Badge tone={tone(h)}>{healthLabel(h)}</Badge>
      {lateMs > 0 && <Badge tone="danger">{lateMs} milestone{lateMs > 1 ? "s" : ""} overdue</Badge>}
      <span className="basis-full text-xs text-muted sm:basis-auto">{g.goal_horizon} · {g.category} · {g.priority} priority · {g.status}{g.target_date ? ` · target ${shortDate(g.target_date)}` : ""}{mine.length ? ` · ${done}/${mine.length} milestones` : ""}</span>
      <ProgressBar value={g.progress_percentage} label={`${g.title} progress`} tone={h.state === "overdue" ? "danger" : "ok"} className="w-24" />
      <span className="w-9 text-right text-xs">{Math.round(g.progress_percentage)}%</span>
    </Link>
  );
}
function Tree({ nodes, today, miles, depth = 0 }: { nodes: Node[]; today: string; miles: Ms[]; depth?: number }) {
  return (
    <ul className={depth ? "ml-5 border-l border-line pl-3" : "space-y-2"}>
      {nodes.map((n) => (<li key={n.id} className="mt-2"><Row g={n} today={today} miles={miles} />{n.children.length > 0 && <Tree nodes={n.children} today={today} miles={miles} depth={depth + 1} />}</li>))}
    </ul>
  );
}

export default function GoalsView({ goals, milestones, today }: { goals: Goal[]; milestones: Ms[]; today: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null), [filter, setFilter] = useState<Filter>("all"), [view, setView] = useState<View>("tree"), [adding, setAdding] = useState(false);
  const health = useMemo(() => new Map(goals.map((g) => [g.id, goalHealth(g, today)])), [goals, today]);
  const count = (f: (g: Goal, h: Health) => boolean) => goals.filter((g) => f(g, health.get(g.id)!)).length;
  const overdue = count((_, h) => h.state === "overdue"), soon = count((_, h) => h.state === "due-soon"), active = count((g) => g.status === "In Progress");
  const finished = count((g) => g.status === "Completed"), stale = goals.filter((g) => isStale({ ...g, status: g.status ?? "" }, today)).length;
  const lateMs = milestones.filter((m) => m.status !== "Completed" && m.target_date && m.target_date < today).length;

  const match = (g: Goal) => { const h = health.get(g.id)!; return filter === "all" || (filter === "overdue" && h.state === "overdue") || (filter === "soon" && h.state === "due-soon") || (filter === "active" && g.status === "In Progress") || (filter === "done" && g.status === "Completed"); };
  const shown = goals.filter(match);
  const timeline = useMemo(() => {
    const dated = shown.filter((g) => g.target_date).sort((a, b) => a.target_date!.localeCompare(b.target_date!));
    const groups = new Map<string, Goal[]>(); dated.forEach((g) => { const k = g.target_date!.slice(0, 7); groups.set(k, [...(groups.get(k) ?? []), g]); });
    return { groups: [...groups.entries()], undated: shown.filter((g) => !g.target_date) };
  }, [shown]);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form), num = (k: string) => (f.get(k) ? Number(f.get(k)) : undefined);
    try {
      await createGoal(createClient(), {
        title: String(f.get("title")), goal_horizon: f.get("goal_horizon") as (typeof HORIZONS)[number], category: f.get("category") as (typeof CATEGORIES)[number], priority: f.get("priority") as "Low", status: "Not Started",
        target_date: (f.get("target_date") as string) || undefined, parent_goal_id: (f.get("parent") as string) || null, target_value: num("target_value"), current_value: num("target_value") ? 0 : undefined, unit: (f.get("unit") as string) || undefined,
      });
      form.reset(); setError(null); setAdding(false); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create goal."); }
  }
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: goals.length }, { id: "overdue", label: "Overdue", count: overdue }, { id: "soon", label: "Due soon", count: soon },
    { id: "active", label: "In progress", count: active }, { id: "done", label: "Completed", count: finished },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Overdue goals" value={overdue} tone={overdue ? "danger" : undefined} sub={overdue ? "Past their target date" : "None overdue"} />
        <Stat label="Overdue milestones" value={lateMs} tone={lateMs ? "danger" : undefined} />
        <Stat label="Due within 7 days" value={soon} />
        <Stat label="In progress" value={active} sub={stale ? `${stale} untouched for 30+ days` : undefined} />
        <Stat label="Completed" value={finished} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs tabs={filters} value={filter} onChange={setFilter} label="Filter goals" />
        <div className="flex items-center gap-2">
          <Tabs tabs={[{ id: "tree" as View, label: "Hierarchy" }, { id: "timeline" as View, label: "Timeline" }]} value={view} onChange={setView} label="Goal view" />
          <button className="btn" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "New goal"}</button>
        </div>
      </div>

      {adding && (
        <form onSubmit={onAdd} className="grid gap-2 rounded-lg border border-line bg-panel p-3 sm:grid-cols-4">
          <label className="sm:col-span-4"><span className="sr-only">Title</span><input name="title" className="input" placeholder="New goal, e.g. Build an AI product" required autoFocus /></label>
          <label className="text-xs text-muted">Horizon<select name="goal_horizon" className="input" defaultValue="Short-Term">{HORIZONS.map((h) => <option key={h}>{h}</option>)}</select></label>
          <label className="text-xs text-muted">Category<select name="category" className="input" defaultValue="Other">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-xs text-muted">Priority<select name="priority" className="input" defaultValue="Medium">{["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="text-xs text-muted">Target date<input name="target_date" type="date" className="input" /></label>
          <label className="text-xs text-muted sm:col-span-2">Parent goal<select name="parent" className="input" defaultValue=""><option value="">None</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.goal_horizon}: {g.title}</option>)}</select></label>
          <label className="text-xs text-muted">Target value (optional)<input name="target_value" type="number" min="0" step="any" className="input" /></label>
          <label className="text-xs text-muted">Unit<input name="unit" className="input" placeholder="books, ₹, kg" /></label>
          <button className="btn sm:col-span-4">Add goal</button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {goals.length === 0 ? <Empty>No goals yet. Start with a 10-Year or 5-Year goal, then add smaller goals under it.</Empty>
        : shown.length === 0 ? <Empty>{filter === "overdue" ? "No overdue goals. Nice work." : "No goals match this filter."}</Empty>
        : view === "timeline" ? (
          <div className="space-y-4">
            {timeline.groups.map(([month, gs]) => (
              <Card key={month} title={new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}>
                <ol className="space-y-2 border-l-2 border-line pl-4">{gs.map((g) => { const h = health.get(g.id)!; return (
                  <li key={g.id} className="relative"><span aria-hidden className={`absolute -left-[1.4rem] top-3 size-3 rounded-full border-2 border-panel ${h.state === "overdue" ? "bg-danger" : h.state === "done" ? "bg-accent" : "bg-muted"}`} />
                    <p className="text-xs text-muted">{shortDate(g.target_date!)} · {h.state === "overdue" ? `${diffDays(today, g.target_date!)} days ago` : g.target_date === today ? "today" : h.days !== null && h.days > 0 ? `in ${h.days} days` : ""}</p><Row g={g} today={today} miles={milestones} /></li>); })}</ol>
              </Card>))}
            {timeline.undated.length > 0 && <Card title="No target date"><ul className="space-y-2">{timeline.undated.map((g) => <li key={g.id}><Row g={g} today={today} miles={milestones} /></li>)}</ul></Card>}
          </div>
        ) : filter === "all" ? <Tree nodes={buildTree(goals)} today={today} miles={milestones} />
        : <ul className="space-y-2">{shown.map((g) => <li key={g.id}><Row g={g} today={today} miles={milestones} /></li>)}</ul>}
    </div>
  );
}
