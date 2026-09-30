import { notFound } from "next/navigation";
import GoalDetail from "@/components/GoalDetail";
import { createClient } from "@/lib/supabase/server";
import { getGoal, getGoals, getMilestones } from "@/lib/services/goals";
import { getTasks } from "@/lib/services/tasks";

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const goal = await getGoal(db, id);
  if (!goal) notFound();
  const [all, milestones, tasks] = await Promise.all([getGoals(db), getMilestones(db, id), getTasks(db, { goalId: id })]);
  const parent = all.find((g) => g.id === goal.parent_goal_id) ?? null;
  return <GoalDetail goal={goal} parent={parent} milestones={milestones} tasks={tasks} children={all.filter((g) => g.parent_goal_id === id)} />;
}
