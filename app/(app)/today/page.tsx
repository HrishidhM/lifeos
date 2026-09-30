import { format } from "date-fns";
import TaskList from "@/components/TaskList";
import { createClient } from "@/lib/supabase/server";
import { completionPct } from "@/utils/calc";

export default async function TodayPage() {
  const db = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const { data, error } = await db.from("tasks").select("id,title,status,priority,due_date").lte("due_date", today).neq("status", "Cancelled");
  if (error) return <p role="alert" className="text-danger">Could not load today&apos;s tasks.</p>;
  const tasks = (data ?? []).filter((t) => t.status !== "Completed" || t.due_date === today);
  const dueToday = tasks.filter((t) => t.due_date === today), done = dueToday.filter((t) => t.status === "Completed").length;
  const overdue = tasks.filter((t) => t.due_date! < today && t.status !== "Completed").length;
  const high = tasks.filter((t) => ["High", "Critical"].includes(t.priority) && t.status !== "Completed").length;
  const pct = Math.round(completionPct(done, dueToday.length));
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Today</h1><p className="text-sm text-muted">{format(new Date(), "EEEE, d MMMM yyyy")}</p></div>
      <div className="bg-panel border border-line rounded-lg p-4"><p className="text-sm">{done} / {dueToday.length} tasks completed ({pct}%) · {overdue} overdue · {high} high priority</p>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Today's progress" className="mt-2 h-2 rounded bg-line"><div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} /></div></div>
      <TaskList initial={tasks} />
    </div>
  );
}
