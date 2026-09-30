import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { completionPct } from "@/utils/calc";

export default async function Dashboard() {
  const db = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const base = () => db.from("tasks").select("id", { count: "exact", head: true });
  const [dueToday, doneToday, overdue] = await Promise.all([
    count(base().eq("due_date", today).neq("status", "Cancelled")),
    count(base().eq("due_date", today).eq("status", "Completed")),
    count(base().lt("due_date", today).in("status", ["Todo", "In Progress"])),
  ]);
  const pct = Math.round(completionPct(doneToday, dueToday));
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted text-sm">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
      </header>
      <section className="bg-panel border border-line rounded-lg p-5" aria-labelledby="prog">
        <h2 id="prog" className="font-semibold">Today&apos;s progress</h2>
        {dueToday === 0 ? (
          <p className="text-muted mt-2 text-sm">No tasks due today. Enjoy the free space, or <Link href="/tasks" className="text-accent underline">add a task</Link>.</p>
        ) : (
          <>
            <p className="mt-2 text-sm">{doneToday} of {dueToday} tasks completed ({pct}%)</p>
            <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-2 rounded bg-line">
              <div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        <p className={`mt-3 text-sm ${overdue ? "text-danger font-semibold" : "text-muted"}`}>{overdue} overdue</p>
      </section>
    </div>
  );
}
