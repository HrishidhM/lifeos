import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, monthStart } from "@/utils/dates";
import type { TaskRow, HabitRow } from "@/utils/analytics";
import type { Goal } from "./goals";

export type AnalyticsRaw = {
  tasksDue: TaskRow[]; tasksDone: TaskRow[]; openTasks: { id: string; goal_id: string | null; due_date: string | null }[];
  goals: Goal[]; milestones: { id: string; goal_id: string; status: string; target_date: string | null; completed_at: string | null }[];
  income: { date: string; amount: number }[]; expenses: { date: string; amount: number; category: string; title: string }[];
  monthBudgets: { category: string; amount: number }[]; monthSpent: { category: string; amount: number }[];
  debts: { id: string; creditor: string; original_amount: number; remaining_amount: number; status: string }[]; payments: { payment_date: string; amount: number }[];
  habits: HabitRow[]; completions: { habit_id: string; completed_on: string }[];
};
const TASK = "id,status,priority,category,due_date,completed_at,estimated_minutes,actual_minutes,goal_id";
const n = (v: unknown) => Number(v ?? 0);

/** All raw rows for a date range in one parallel round. Metrics are computed client-side so changing tabs never refetches. */
export async function getAnalytics(db: SupabaseClient, from: string, to: string): Promise<AnalyticsRaw> {
  const endMonth = monthStart(to), nextMonth = monthStart(addDays(endMonth, 32));
  const r = await Promise.all([
    db.from("tasks").select(TASK).gte("due_date", from).lte("due_date", to).neq("status", "Cancelled"),
    db.from("tasks").select(TASK).gte("completed_at", addDays(from, -1)).lte("completed_at", `${addDays(to, 1)}T23:59:59`),
    db.from("tasks").select("id,goal_id,due_date").in("status", ["Todo", "In Progress"]),
    db.from("goals").select("*"),
    db.from("goal_milestones").select("id,goal_id,status,target_date,completed_at"),
    db.from("income").select("date,amount").gte("date", from).lte("date", to),
    db.from("expenses").select("date,amount,category,title").gte("date", from).lte("date", to),
    db.from("budgets").select("category,amount").eq("month", endMonth),
    db.from("expenses").select("category,amount").gte("date", endMonth).lt("date", nextMonth),
    db.from("debts").select("id,creditor,original_amount,remaining_amount,status").neq("status", "Cancelled"),
    db.from("debt_payments").select("payment_date,amount").gte("payment_date", from),
    db.from("habits").select("id,name,start_date").eq("active", true),
    db.from("habit_completions").select("habit_id,completed_on").gte("completed_on", from).lte("completed_on", to),
  ]);
  if (r.some((x) => x.error)) throw new Error("Could not load analytics. Please try again.");
  const d = r.map((x) => x.data ?? []) as Record<string, unknown>[][];
  return {
    tasksDue: d[0] as unknown as TaskRow[], tasksDone: d[1] as unknown as TaskRow[], openTasks: d[2] as AnalyticsRaw["openTasks"],
    goals: d[3].map((g) => ({ ...g, progress_percentage: n(g.progress_percentage) })) as unknown as Goal[],
    milestones: d[4] as AnalyticsRaw["milestones"],
    income: d[5].map((x) => ({ date: x.date as string, amount: n(x.amount) })),
    expenses: d[6].map((x) => ({ date: x.date as string, amount: n(x.amount), category: x.category as string, title: x.title as string })),
    monthBudgets: d[7].map((x) => ({ category: x.category as string, amount: n(x.amount) })),
    monthSpent: d[8].map((x) => ({ category: x.category as string, amount: n(x.amount) })),
    debts: d[9].map((x) => ({ ...x, original_amount: n(x.original_amount), remaining_amount: n(x.remaining_amount) })) as AnalyticsRaw["debts"],
    payments: d[10].map((x) => ({ payment_date: x.payment_date as string, amount: n(x.amount) })),
    habits: d[11] as unknown as HabitRow[], completions: d[12] as AnalyticsRaw["completions"],
  };
}
