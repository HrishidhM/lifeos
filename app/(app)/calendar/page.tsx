import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

type Ev = { date: string; kind: string; title: string };

export default async function CalendarPage() {
  const db = await createClient();
  const from = format(new Date(), "yyyy-MM-dd"), to = format(addDays(new Date(), 30), "yyyy-MM-dd");
  const [t, m, d, s, g, c] = await Promise.all([
    db.from("tasks").select("title,due_date").gte("due_date", from).lte("due_date", to).in("status", ["Todo", "In Progress"]),
    db.from("goal_milestones").select("title,target_date").gte("target_date", from).lte("target_date", to).neq("status", "Completed"),
    db.from("debts").select("creditor,due_date").gte("due_date", from).lte("due_date", to).eq("status", "Active"),
    db.from("shopping_items").select("item,planned_date").gte("planned_date", from).lte("planned_date", to).in("status", ["Planned", "Ordered"]),
    db.from("goals").select("title,target_date").gte("target_date", from).lte("target_date", to).not("status", "in", "(Completed,Cancelled)"),
    db.from("calendar_events").select("title,start_time").gte("start_time", from).lte("start_time", `${to}T23:59:59`),
  ]);
  if ([t, m, d, s, g, c].some((r) => r.error)) return <p role="alert" className="text-danger">Could not load calendar.</p>;
  const events: Ev[] = [
    ...(t.data ?? []).map((x) => ({ date: x.due_date, kind: "Task", title: x.title })),
    ...(m.data ?? []).map((x) => ({ date: x.target_date, kind: "Milestone", title: x.title })),
    ...(d.data ?? []).map((x) => ({ date: x.due_date, kind: "Debt payment", title: x.creditor })),
    ...(s.data ?? []).map((x) => ({ date: x.planned_date, kind: "Purchase", title: x.item })),
    ...(g.data ?? []).map((x) => ({ date: x.target_date, kind: "Goal deadline", title: x.title })),
    ...(c.data ?? []).map((x) => ({ date: String(x.start_time).slice(0, 10), kind: "Event", title: x.title })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const days = [...new Set(events.map((e) => e.date))];
  return (
    <div className="space-y-4"><h1 className="text-2xl font-bold">Calendar</h1><p className="text-sm text-muted">Next 30 days</p>
      {days.length === 0 ? <p className="text-sm text-muted">Nothing scheduled in the next 30 days.</p> : days.map((day) => (
        <section key={day} aria-label={day}><h2 className="font-semibold text-sm">{format(new Date(`${day}T00:00:00`), "EEE, d MMM")}</h2>
          <ul className="mt-1 divide-y divide-line bg-panel border border-line rounded-lg text-sm">{events.filter((e) => e.date === day).map((e, i) => (
            <li key={i} className="flex gap-3 p-2"><span className="w-28 text-muted">{e.kind}</span><span>{e.title}</span></li>))}</ul></section>))}
    </div>
  );
}
