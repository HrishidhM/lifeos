import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logActivity } from "./activity";
import { shiftDate } from "@/utils/streak";

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
  frequency: z.enum(["Daily", "Weekly", "Custom"]).default("Daily"),
});
export type Habit = { id: string; name: string; description: string | null; frequency: string; dates: string[] };

const fail = (m: string): never => { throw new Error(m); };
const userId = async (db: SupabaseClient) => (await db.auth.getUser()).data.user?.id ?? fail("Not signed in");

/** Two queries total: active habits, plus completions for the last 400 days grouped in memory. */
export async function getHabits(db: SupabaseClient, today: string): Promise<Habit[]> {
  const [h, c] = await Promise.all([
    db.from("habits").select("id,name,description,frequency").eq("active", true).order("created_at"),
    db.from("habit_completions").select("habit_id,completed_on").gte("completed_on", shiftDate(today, -400)),
  ]);
  if (h.error || c.error) fail("Could not load habits.");
  return (h.data ?? []).map((x) => ({ ...x, dates: (c.data ?? []).filter((r) => r.habit_id === x.id).map((r) => r.completed_on as string) }));
}
export async function createHabit(db: SupabaseClient, input: z.infer<typeof habitSchema>) {
  const v = habitSchema.parse(input);
  if ((await db.from("habits").insert({ ...v, user_id: await userId(db) })).error) fail("Could not create habit.");
}
export async function toggleHabit(db: SupabaseClient, habit: Habit, day: string, done: boolean) {
  if (done) {
    const { error } = await db.from("habit_completions").delete().eq("habit_id", habit.id).eq("completed_on", day);
    if (error) fail("Could not update habit.");
  } else {
    const { error } = await db.from("habit_completions").upsert({ habit_id: habit.id, completed_on: day, user_id: await userId(db) }, { onConflict: "habit_id,completed_on" });
    if (error) fail("Could not update habit.");
    await logActivity(db, { type: "HABIT_COMPLETED", entityType: "habit", entityId: habit.id, description: `Completed habit "${habit.name}"` });
  }
}
export async function deleteHabit(db: SupabaseClient, id: string) {
  if ((await db.from("habits").delete().eq("id", id)).error) fail("Could not delete habit.");
}
