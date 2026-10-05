import { notFound } from "next/navigation";
import GoalDetail from "@/components/GoalDetail";
import { createClient } from "@/lib/supabase/server";
import { getGoal, getGoals, getMilestones } from "@/lib/services/goals";
import { getContext } from "@/lib/services/profile";
import { getTasks } from "@/lib/services/tasks";

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const goal = await getGoal(db, id);
  if (!goal) notFound();
  const [all, milestones, tasks, ctx] = await Promise.all([getGoals(db), getMilestones(db, id), getTasks(db, { goalId: id }), getContext(db)]);
  const parent = all.find((g) => g.id === goal.parent_goal_id) ?? null;
  return <GoalDetail today={ctx.today} goal={{ ...goal, progress_percentage: Number(goal.progress_percentage) }} parent={parent} milestones={milestones} tasks={tasks} childGoals={all.filter((g) => g.parent_goal_id === id).map((g) => ({ ...g, progress_percentage: Number(g.progress_percentage) }))} />;
}
