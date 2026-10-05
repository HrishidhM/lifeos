import { diffDays } from "./dates";

export type GoalLike = { status: string; target_date?: string | null; updated_at?: string };
export type Health = { state: "done" | "cancelled" | "overdue" | "due-soon" | "paused" | "ok"; days: number | null };

const SOON_DAYS = 7;

/** Overdue = a deadline in the past on a goal that is not finished. Never colour-only: callers also show healthLabel(). */
export function goalHealth(g: GoalLike, today: string): Health {
  if (g.status === "Completed") return { state: "done", days: null };
  if (g.status === "Cancelled") return { state: "cancelled", days: null };
  const days = g.target_date ? diffDays(g.target_date, today) : null;
  if (days !== null && days < 0) return { state: "overdue", days };
  if (days !== null && days <= SOON_DAYS) return { state: "due-soon", days };
  if (g.status === "Paused") return { state: "paused", days };
  return { state: "ok", days };
}
export function healthLabel(h: Health) {
  switch (h.state) {
    case "overdue": return `Overdue by ${-h.days!}d`;
    case "due-soon": return h.days === 0 ? "Due today" : `Due in ${h.days}d`;
    case "done": return "Completed";
    case "cancelled": return "Cancelled";
    case "paused": return "Paused";
    default: return h.days === null ? "No deadline" : `${h.days}d left`;
  }
}
/** In-progress goals untouched for `days` days. */
export function isStale(g: GoalLike, today: string, days = 30) {
  if (g.status !== "In Progress" || !g.updated_at) return false;
  return diffDays(today, g.updated_at.slice(0, 10)) >= days;
}
export const HORIZON_ORDER = ["Daily", "Short-Term", "Medium-Term", "Long-Term", "5-Year", "10-Year"] as const;
