"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { completeTask, createTask, deleteTask, reopenTask } from "@/lib/services/tasks";

type Task = { id: string; title: string; status: string; priority: string; due_date: string | null };
const priorities = ["Low", "Medium", "High", "Critical"] as const;

export default function TaskList({ initial, goals = [] }: { initial: Task[]; goals?: { id: string; title: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const shown = initial.filter((t) => filter === "all" || (filter === "done") === (t.status === "Completed"));

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); router.refresh(); } catch (e) { setError((e as Error).message); }
  }
  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    await run(() => createTask(createClient(), {
      title: String(f.get("title")), priority: f.get("priority") as (typeof priorities)[number],
      status: "Todo", goal_id: (f.get("goal_id") as string) || undefined, due_date: (f.get("due_date") as string) || undefined,
    }));
    form.reset();
  }

  return (
    <>
      <form onSubmit={onAdd} className="flex flex-wrap gap-2 bg-panel border border-line rounded-lg p-3">
        <label className="flex-1 min-w-48"><span className="sr-only">Title</span><input name="title" className="input" placeholder="New task" required /></label>
        <label><span className="sr-only">Priority</span>
          <select name="priority" defaultValue="Medium" className="input">{priorities.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label><span className="sr-only">Due date</span><input name="due_date" type="date" className="input" /></label>
        {goals.length > 0 && <label><span className="sr-only">Goal</span><select name="goal_id" className="input" defaultValue=""><option value="">No goal</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
        <button className="btn">Add task</button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2 text-sm" role="group" aria-label="Filter tasks">
        {(["open", "done", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`rounded-md px-3 py-1 border border-line ${filter === f ? "bg-accent text-accent-ink" : "bg-panel"}`}>{f[0].toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-muted text-sm">{filter === "open" ? "No open tasks. Enjoy the free space, or add a task." : "Nothing here yet."}</p>
      ) : (
        <ul className="divide-y divide-line bg-panel border border-line rounded-lg">
          {shown.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-3">
              <input type="checkbox" aria-label={`Mark "${t.title}" complete`} checked={t.status === "Completed"}
                onChange={() => run(() => (t.status === "Completed" ? reopenTask(createClient(), t.id) : completeTask(createClient(), t.id)))} />
              <div className="flex-1 min-w-0">
                <p className={t.status === "Completed" ? "line-through text-muted" : ""}>{t.title}</p>
                <p className="text-xs text-muted">{t.priority}{t.due_date ? ` · due ${t.due_date}` : ""}</p>
              </div>
              <button aria-label={`Delete "${t.title}"`} className="text-muted hover:text-danger"
                onClick={() => confirm(`Delete "${t.title}"?`) && run(() => deleteTask(createClient(), t.id))}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
