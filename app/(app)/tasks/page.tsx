import TaskList from "@/components/TaskList";
import OverdueTasks from "@/components/OverdueTasks";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/services/goals";
import { getTasks } from "@/lib/services/tasks";
import { getContext } from "@/lib/services/profile";
import { isOverdueTask } from "@/utils/tasks";

export default async function TasksPage() {
  const db = await createClient();
  const [tasks, goals, ctx] = await Promise.all([getTasks(db), getGoals(db), getContext(db)]);
  const overdue = tasks.filter((t) => isOverdueTask(t, ctx.today));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tasks</h1>
      <OverdueTasks tasks={overdue} goals={goals} today={ctx.today} timezone={ctx.timezone} />
      <TaskList initial={tasks} goals={goals} today={ctx.today} />
    </div>
  );
}
