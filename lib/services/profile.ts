import type { SupabaseClient } from "@supabase/supabase-js";
import { hourIn, todayIn } from "@/utils/dates";

export type Ctx = { currency: string; timezone: string; today: string; hour: number; name: string };

/** One cheap query that every page can use to get "today" in the user's own timezone. */
export async function getContext(db: SupabaseClient): Promise<Ctx> {
  const [{ data: p }, { data: { user } }] = await Promise.all([
    db.from("profiles").select("currency,timezone,full_name").maybeSingle(),
    db.auth.getUser(),
  ]);
  const timezone = p?.timezone ?? "Asia/Kolkata";
  const name = (p?.full_name as string | null) || (user?.user_metadata?.full_name as string | undefined) || "";
  return { currency: p?.currency ?? "INR", timezone, today: todayIn(timezone), hour: hourIn(timezone), name };
}
