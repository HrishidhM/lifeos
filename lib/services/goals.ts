import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logActivity } from "./activity";
import { onlyProvided } from "@/utils/patch";

export const HORIZONS = ["10-Year", "5-Year", "Long-Term", "Medium-Term", "Short-Term", "Daily"] as const;
export const CATEGORIES = ["Career", "Finance", "Education", "Health", "Business", "Personal Development", "Relationships", "Travel", "Lifestyle", "Other"] as const;

export const goalSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().optional(),
  goal_horizon: z.enum(HORIZONS),
  category: z.enum(CATEGORIES).default("Other"),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
  status: z.enum(["Not Started", "In Progress", "Completed", "Paused", "Cancelled"]).default("Not Started"),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  parent_goal_id: z.string().uuid().nullable().optional(),
  target_value: z.number().positive("Target must be above 0").optional(),
  current_value: z.number().min(0, "Cannot be negative").optional(),
  unit: z.string().optional(),
  progress_percentage: z.number().min(0).max(100).optional(),
});
export type GoalInput = z.infer<typeof goalSchema>;
export type Goal = GoalInput & { id: string; progress_percentage: number; start_date?: string | null; created_at?: string; updated_at?: string };

const fail = (m: string): never => { throw new Error(m); };

export async function getGoals(db: SupabaseClient): Promise<Goal[]> {
  const { data, error } = await db.from("goals").select("*").order("target_date", { nullsFirst: false });
  if (error) fail("Could not load goals.");
  return data as Goal[];
}
export async function getGoal(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("goals").select("*").eq("id", id).maybeSingle();
  if (error) fail("Could not load goal.");
  return data as Goal | null;
}
export async function createGoal(db: SupabaseClient, input: GoalInput) {
  const v = goalSchema.parse(input);
  const { data: { user } } = await db.auth.getUser();
  if (!user) fail("Not signed in");
  const { data, error } = await db.from("goals").insert({ ...v, user_id: user!.id }).select().single();
  if (error) fail("Could not create goal.");
  await logActivity(db, { type: "GOAL_CREATED", entityType: "goal", entityId: data.id, description: `Created goal "${data.title}"` });
  return data as Goal;
}
export async function updateGoal(db: SupabaseClient, id: string, input: Partial<GoalInput>) {
  const { error } = await db.from("goals").update(onlyProvided(goalSchema.partial().parse(input), input)).eq("id", id);
  if (error) fail("Could not update goal.");
  await logActivity(db, { type: "GOAL_UPDATED", entityType: "goal", entityId: id, description: "Updated goal" });
}
export async function deleteGoal(db: SupabaseClient, id: string) {
  const { error } = await db.from("goals").delete().eq("id", id);
  if (error) fail("Could not delete goal.");
}

export async function getMilestones(db: SupabaseClient, goalId: string) {
  const { data, error } = await db.from("goal_milestones").select("*").eq("goal_id", goalId).order("target_date", { nullsFirst: false });
  if (error) fail("Could not load milestones.");
  return data as { id: string; title: string; status: string; target_date: string | null }[];
}
export async function createMilestone(db: SupabaseClient, goalId: string, title: string, targetDate?: string) {
  const t = z.string().trim().min(1, "Milestone title is required").parse(title);
  const { data: { user } } = await db.auth.getUser();
  if (!user) fail("Not signed in");
  const { error } = await db.from("goal_milestones").insert({ goal_id: goalId, user_id: user!.id, title: t, target_date: targetDate || null });
  if (error) fail("Could not add milestone.");
}
export async function completeMilestone(db: SupabaseClient, id: string, title: string) {
  const { error } = await db.from("goal_milestones")
    .update({ status: "Completed", progress_percentage: 100, completed_at: new Date().toISOString() }).eq("id", id);
  if (error) fail("Could not complete milestone.");
  await logActivity(db, { type: "MILESTONE_COMPLETED", entityType: "milestone", entityId: id, description: `Completed milestone "${title}"` });
}
export async function deleteMilestone(db: SupabaseClient, id: string) {
  const { error } = await db.from("goal_milestones").delete().eq("id", id);
  if (error) fail("Could not delete milestone.");
}

/** Group goals into a parent -> children tree. Orphans and cycles surface as roots. */
export function buildTree(goals: Goal[]) {
  type Node = Goal & { children: Node[] };
  const map = new Map<string, Node>(goals.map((g) => [g.id, { ...g, children: [] }]));
  const roots: Node[] = [];
  map.forEach((n) => {
    const p = n.parent_goal_id ? map.get(n.parent_goal_id) : undefined;
    (p ? p.children : roots).push(n);
  });
  return roots;
}

export async function getMilestoneSummary(db: SupabaseClient) {
  const { data, error } = await db.from("goal_milestones").select("id,goal_id,title,status,target_date").order("target_date", { nullsFirst: false });
  if (error) fail("Could not load milestones.");
  return data as { id: string; goal_id: string; title: string; status: string; target_date: string | null }[];
}
