"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge, ProgressBar } from "@/components/ui";
import { goalHealth, healthLabel } from "@/utils/goals";
import { completeMilestone, createMilestone, deleteGoal, deleteMilestone, updateGoal, type Goal } from "@/lib/services/goals";

type Ms = { id: string; title: string; status: string; target_date: string | null };
type Props = { today: string; goal: Goal; parent: Goal | null; childGoals: Goal[]; milestones: Ms[]; tasks: { id: string; title: string; status: string }[] };

export default function GoalDetail({ today, goal, parent, childGoals, milestones, tasks }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const health = goalHealth(goal, today);
  async function run(fn: () => Promise<unknown>, after?: () => void) {
    try { await fn(); setError(null); if (after) after(); else router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }
  const db = createClient;
  const byTarget = goal.target_value != null && goal.current_value != null;

  return (
    <div className="space-y-6">
      <div>
        {parent && <Link href={`/goals/${parent.id}`} className="text-sm text-accent underline">↑ {parent.goal_horizon}: {parent.title}</Link>}
        <h1 className="text-2xl font-bold">{goal.title}</h1>
        <p className="text-sm text-muted">{goal.goal_horizon} · {goal.category} · {goal.priority} · {goal.status}{goal.target_date ? ` · target ${goal.target_date}` : ""}</p>
        {goal.description && <p className="mt-2">{goal.description}</p>}
        {health.state === "overdue" && (
          <div role="alert" className="mt-3 rounded-lg border border-danger/50 bg-danger/5 p-3 text-sm"><Badge tone="danger">{healthLabel(health)}</Badge> <span className="ml-1">The target date ({goal.target_date}) has passed and this goal is not complete. Update the progress, move the date, or mark it complete.</span></div>
        )}
        {health.state === "due-soon" && <p className="mt-3"><Badge tone="warn">{healthLabel(health)}</Badge></p>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <section className="bg-panel border border-line rounded-lg p-4 space-y-3" aria-labelledby="pg">
        <h2 id="pg" className="font-semibold">Progress: {Math.round(goal.progress_percentage)}%</h2>
        <ProgressBar value={goal.progress_percentage} label="Goal progress" tone={health.state === "overdue" ? "danger" : "ok"} />
        <form className="flex gap-2 items-end" onSubmit={(e) => {
          e.preventDefault();
          const v = Number(new FormData(e.currentTarget).get("v"));
          run(() => updateGoal(db(), goal.id, byTarget ? { current_value: v, status: "In Progress" } : { progress_percentage: v, status: v >= 100 ? "Completed" : "In Progress" }));
        }}>
          <label className="text-xs text-muted">{byTarget ? `Current value${goal.unit ? ` (${goal.unit})` : ""} of ${goal.target_value}` : "Percent complete (0–100)"}
            <input name="v" type="number" min="0" max={byTarget ? undefined : 100} step="any" className="input" defaultValue={byTarget ? goal.current_value : Math.round(goal.progress_percentage)} required /></label>
          <button className="btn">Update</button>
        </form>
      </section>

      <section aria-labelledby="ms" className="space-y-2">
        <h2 id="ms" className="font-semibold">Milestones</h2>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
          run(() => createMilestone(db(), goal.id, String(f.get("title")), String(f.get("date") || "")), () => { form.reset(); router.refresh(); });
        }}>
          <label className="flex-1 min-w-40"><span className="sr-only">Milestone</span><input name="title" className="input" placeholder="Add a milestone" required /></label>
          <label><span className="sr-only">Date</span><input name="date" type="date" className="input" /></label>
          <button className="btn">Add</button>
        </form>
        {milestones.length === 0 ? <p className="text-sm text-muted">No milestones yet.</p> : (
          <ul className="divide-y divide-line bg-panel border border-line rounded-lg">
            {milestones.map((m) => {
              const overdue = m.status !== "Completed" && m.target_date && m.target_date < today;
              return (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  <input type="checkbox" checked={m.status === "Completed"} disabled={m.status === "Completed"} aria-label={`Complete "${m.title}"`} onChange={() => run(() => completeMilestone(db(), m.id, m.title))} />
                  <span className={`flex-1 ${m.status === "Completed" ? "line-through text-muted" : ""}`}>{m.title}</span>
                  <span className={`text-xs ${overdue ? "text-danger font-semibold" : "text-muted"}`}>{m.status === "Completed" ? "Done" : overdue ? "Overdue" : "Upcoming"}{m.target_date ? ` · ${m.target_date}` : ""}</span>
                  <button className="text-xs text-muted hover:text-danger" onClick={() => confirm(`Delete milestone "${m.title}"?`) && run(() => deleteMilestone(db(), m.id))}>Delete</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {childGoals.length > 0 && (
        <section aria-labelledby="ch"><h2 id="ch" className="font-semibold mb-2">Child goals</h2>
          <ul className="space-y-1">{childGoals.map((c) => <li key={c.id}><Link className="text-accent underline" href={`/goals/${c.id}`}>{c.goal_horizon}: {c.title}</Link> <span className="text-xs text-muted">{Math.round(c.progress_percentage)}%</span> {goalHealth(c, today).state === "overdue" && <Badge tone="danger">{healthLabel(goalHealth(c, today))}</Badge>}</li>)}</ul></section>
      )}
      <section aria-labelledby="tk"><h2 id="tk" className="font-semibold mb-2">Linked tasks</h2>
        {tasks.length === 0 ? <p className="text-sm text-muted">No tasks linked to this goal yet.</p> :
          <ul className="space-y-1 text-sm">{tasks.map((t) => <li key={t.id} className={t.status === "Completed" ? "line-through text-muted" : ""}>{t.title}</li>)}</ul>}
      </section>
      <button className="text-sm text-danger underline" onClick={() => confirm(`Delete "${goal.title}"? Child goals will be kept.`) && run(() => deleteGoal(db(), goal.id), () => router.push("/goals"))}>Delete goal</button>
    </div>
  );
}
