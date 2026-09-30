import TaskList from "@/components/TaskList";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/services/goals";
import { getTasks } from "@/lib/services/tasks";

export default async function TasksPage() {
  const db = await createClient();
  let tasks: Awaited<ReturnType<typeof getTasks>> = [];
  let error: string | null = null;
  let goals: { id: string; title: string }[] = [];
  try { [tasks, goals] = await Promise.all([getTasks(db), getGoals(db)]); } catch (e) { error = (e as Error).message; }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tasks</h1>
      {error ? <p role="alert" className="text-danger">{error}</p> : <TaskList initial={tasks} goals={goals} />}
    </div>
  );
}
