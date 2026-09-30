import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityType =
  | "TASK_CREATED" | "TASK_UPDATED" | "TASK_COMPLETED" | "GOAL_CREATED" | "GOAL_UPDATED"
  | "MILESTONE_COMPLETED" | "EXPENSE_ADDED" | "INCOME_ADDED" | "DEBT_PAYMENT" | "PURCHASE_COMPLETED" | "HABIT_COMPLETED";

export async function logActivity(
  db: SupabaseClient,
  a: { type: ActivityType; entityType: string; entityId: string; description: string },
) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;
  await db.from("activity_logs").insert({
    user_id: user.id, type: a.type, entity_type: a.entityType, entity_id: a.entityId, description: a.description,
  });
}
