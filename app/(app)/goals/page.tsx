import GoalsView from "@/components/GoalsView";
import { createClient } from "@/lib/supabase/server";
import { getGoals, type Goal } from "@/lib/services/goals";

export default async function GoalsPage() {
  const db = await createClient();
  let goals: Goal[] = [];
  let error: string | null = null;
  try { goals = await getGoals(db); } catch (e) { error = (e as Error).message; }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Goals</h1>
      {error ? <p role="alert" className="text-danger">{error}</p> : <GoalsView goals={goals} />}
    </div>
  );
}
