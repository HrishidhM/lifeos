import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logActivity } from "./activity";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
  status: z.enum(["Todo", "In Progress", "Completed", "Cancelled"]).default("Todo"),
  category: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  estimated_minutes: z.number().int().positive().optional(),
  goal_id: z.string().uuid().optional(),
  milestone_id: z.string().uuid().optional(),
});
export type TaskInput = z.infer<typeof taskSchema>;

export async function getTasks(db: SupabaseClient, f: { status?: string; search?: string; goalId?: string } = {}) {
  let q = db.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.goalId) q = q.eq("goal_id", f.goalId);
  if (f.search) q = q.ilike("title", `%${f.search}%`);
  const { data, error } = await q;
  if (error) throw new Error("Could not load tasks. Please try again.");
  return data;
}

export async function createTask(db: SupabaseClient, input: TaskInput) {
  const v = taskSchema.parse(input);
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await db.from("tasks").insert({ ...v, user_id: user.id }).select().single();
  if (error) throw new Error("Could not create task.");
  await logActivity(db, { type: "TASK_CREATED", entityType: "task", entityId: data.id, description: `Created task "${data.title}"` });
  return data;
}

export async function updateTask(db: SupabaseClient, id: string, input: Partial<TaskInput>) {
  const { data, error } = await db.from("tasks").update(taskSchema.partial().parse(input)).eq("id", id).select().single();
  if (error) throw new Error("Could not update task.");
  return data;
}

export async function deleteTask(db: SupabaseClient, id: string) {
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) throw new Error("Could not delete task.");
}

export async function completeTask(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("tasks")
    .update({ status: "Completed", completed_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new Error("Could not complete task.");
  await logActivity(db, { type: "TASK_COMPLETED", entityType: "task", entityId: id, description: `Completed task "${data.title}"` });
  return data;
}

export async function reopenTask(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("tasks").update({ status: "Todo", completed_at: null }).eq("id", id).select().single();
  if (error) throw new Error("Could not reopen task.");
  return data;
}
