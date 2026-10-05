import Link from "next/link";
import { addDays } from "@/utils/dates";
import { getContext } from "@/lib/services/profile";
import { createClient } from "@/lib/supabase/server";

const diff = (d: string, today: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000);
const when = (n: number) => (n < 0 ? `Overdue by ${-n}d` : n === 0 ? "Due today" : `Due in ${n}d`);

/** Shown at the top of every app page: overdue items and anything due in the next 3 days. */
export default async function DeadlineBanner() {
  const db = await createClient();
  const { today } = await getContext(db), soon = addDays(today, 3);
  const [t, m, g, d] = await Promise.all([
    db.from("tasks").select("title,due_date").lte("due_date", soon).in("status", ["Todo", "In Progress"]),
    db.from("goal_milestones").select("title,target_date").lte("target_date", soon).neq("status", "Completed"),
    db.from("goals").select("id,title,target_date").lte("target_date", soon).not("status", "in", "(Completed,Cancelled)"),
    db.from("debts").select("creditor,due_date").lte("due_date", soon).eq("status", "Active"),
  ]);
  const items = [
    ...(t.data ?? []).map((x) => ({ kind: "Task", title: x.title, date: x.due_date as string, href: "/tasks" })),
    ...(m.data ?? []).map((x) => ({ kind: "Milestone", title: x.title, date: x.target_date as string, href: "/goals" })),
    ...(g.data ?? []).map((x) => ({ kind: "Goal", title: x.title, date: x.target_date as string, href: `/goals/${x.id}` })),
    ...(d.data ?? []).map((x) => ({ kind: "Debt payment", title: x.creditor, date: x.due_date as string, href: "/debt" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (items.length === 0) return null;
  const late = items.filter((i) => i.date < today).length;
  return (
    <details open className="mb-4 rounded-lg border border-line bg-panel p-3">
      <summary className="cursor-pointer text-sm font-semibold">Deadlines: {items.length} need attention{late ? ` (${late} overdue)` : ""}</summary>
      <ul className="mt-2 space-y-1 text-sm">
        {items.slice(0, 8).map((i, k) => (
          <li key={k}><Link href={i.href} className="underline">{i.title}</Link> <span className="text-muted">· {i.kind} · </span>
            <span className={i.date < today ? "text-danger font-semibold" : ""}>{when(diff(i.date, today))}</span></li>))}
      </ul>
      {items.length > 8 && <p className="mt-1 text-xs text-muted">+{items.length - 8} more</p>}
    </details>
  );
}
