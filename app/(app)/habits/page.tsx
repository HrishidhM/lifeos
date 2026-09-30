import HabitsView from "@/components/HabitsView";
import { createClient } from "@/lib/supabase/server";
import { getHabits } from "@/lib/services/habits";
import { localDate } from "@/utils/streak";

export default async function HabitsPage() {
  const db = await createClient();
  try {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Habits</h1>
        <HabitsView habits={await getHabits(db, localDate())} />
      </div>
    );
  } catch (e) {
    return <p role="alert" className="text-danger">{(e as Error).message}</p>;
  }
}
