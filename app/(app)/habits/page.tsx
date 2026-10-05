import HabitsView from "@/components/HabitsView";
import { createClient } from "@/lib/supabase/server";
import { getHabits } from "@/lib/services/habits";
import { getContext } from "@/lib/services/profile";

export default async function HabitsPage() {
  const db = await createClient();
  const { today } = await getContext(db);
  return (<div className="space-y-4"><h1 className="text-2xl font-bold">Habits</h1><HabitsView habits={await getHabits(db, today)} today={today} /></div>);
}
