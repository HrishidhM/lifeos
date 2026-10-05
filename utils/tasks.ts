export const MAX_RESCHEDULES = 3;

type TaskLike = { due_date?: string | null; status: string; reschedule_count?: number | null };

export const isOverdueTask = (t: TaskLike, today: string) => !!t.due_date && t.due_date < today && (t.status === "Todo" || t.status === "In Progress");

/** How many date edits an overdue task has used and has left. The database enforces the same limit. */
export function rescheduleInfo(t: TaskLike, today: string) {
  const used = Math.min(MAX_RESCHEDULES, t.reschedule_count ?? 0), remaining = MAX_RESCHEDULES - used;
  const overdueDays = t.due_date && t.due_date < today ? Math.round((Date.parse(today) - Date.parse(t.due_date)) / 86_400_000) : 0;
  return { used, remaining, locked: remaining === 0, isLast: remaining === 1, nextAttempt: Math.min(MAX_RESCHEDULES, used + 1), overdueDays };
}

/** Turns database errors into messages a person can act on (raw SQL errors are never shown). */
export function rescheduleErrorMessage(error: { message?: string; code?: string }) {
  const m = error.message ?? "";
  if (m.includes("RESCHEDULE_LIMIT")) return `This task has used all ${MAX_RESCHEDULES} date edits. Complete it or cancel it instead.`;
  if (m.includes("RESCHEDULE_PAST_DATE")) return "Pick today or a later date.";
  if (error.code === "PGRST202" || m.includes("reschedule_task")) return "The overdue-edit database update is missing. Run supabase/migrations/0002_task_reschedule_limit.sql, then try again.";
  if (m.includes("TASK_NOT_FOUND")) return "That task no longer exists.";
  return "Could not change the date. Please try again.";
}
