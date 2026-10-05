import GoalsView from "@/components/GoalsView";
import { createClient } from "@/lib/supabase/server";
import { getGoals, getMilestoneSummary } from "@/lib/services/goals";
import { getContext } from "@/lib/services/profile";

export default async function GoalsPage() {
  const db = await createClient();
  const [goals, milestones, ctx] = await Promise.all([getGoals(db), getMilestoneSummary(db), getContext(db)]);
  return (
    <div className="space-y-4"><h1 className="text-2xl font-bold">Goals</h1>
      <GoalsView goals={goals.map((g) => ({ ...g, progress_percentage: Number(g.progress_percentage) }))} milestones={milestones} today={ctx.today} /></div>
  );
}
