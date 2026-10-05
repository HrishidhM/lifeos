import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, localDay, monthStart, shortMonth } from "@/utils/dates";
import { groupTotals, foldTop } from "@/utils/analytics";
import { getContext, type Ctx } from "./profile";
import { getHabits, type Habit } from "./habits";
import type { Goal } from "./goals";

export type DashTask = { id: string; title: string; status: string; priority: string; due_date: string | null; goal_id: string | null };
export type DashMilestone = { id: string; goal_id: string; title: string; target_date: string | null; status: string };
export type DashDebt = { id: string; creditor: string; original_amount: number; remaining_amount: number; due_date: string | null; status: string; minimum_payment: number | null };
export type DashItem = { id: string; item: string; estimated_price: number | null; priority: string; planned_date: string | null; status: string };
export type DashboardData = {
  ctx: Ctx; todayTasks: DashTask[]; overdueTasks: DashTask[]; overdueTaskCount: number; completedByDay: { label: string; Completed: number }[];
  goals: Goal[]; milestones: DashMilestone[];
  finance: { months: { label: string; Income: number; Expenses: number; Savings: number }[]; income: number; expenses: number; categories: { name: string; value: number }[]; budgets: { category: string; amount: number; spent: number }[] };
  debts: DashDebt[]; shopping: DashItem[]; habits: Habit[];
  activity: { id: string; type: string; description: string | null; created_at: string }[]; events: { id: string; title: string; start_time: string }[];
};

const num = (v: unknown) => Number(v ?? 0);
const TASK_COLS = "id,title,status,priority,due_date,goal_id";

/** One round of parallel queries; everything else is computed in memory. */
export async function getDashboardData(db: SupabaseClient): Promise<DashboardData> {
  const ctx = await getContext(db);
  const { today, timezone } = ctx, thisMonth = monthStart(today), from6 = addMonths(thisMonth, -5), since14 = addDays(today, -14);
  const [todayT, overdueT, doneT, goals, miles, inc, exp, bud, debts, shop, habits, acts, events] = await Promise.all([
    db.from("tasks").select(TASK_COLS).eq("due_date", today).neq("status", "Cancelled"),
    db.from("tasks").select(TASK_COLS, { count: "exact" }).lt("due_date", today).in("status", ["Todo", "In Progress"]).order("due_date").limit(8),
    db.from("tasks").select("completed_at").not("completed_at", "is", null).gte("completed_at", since14),
    db.from("goals").select("*"),
    db.from("goal_milestones").select("id,goal_id,title,target_date,status").neq("status", "Completed").neq("status", "Cancelled").order("target_date", { nullsFirst: false }).limit(40),
    db.from("income").select("date,amount").gte("date", from6),
    db.from("expenses").select("date,amount,category").gte("date", from6),
    db.from("budgets").select("category,amount").eq("month", thisMonth),
    db.from("debts").select("id,creditor,original_amount,remaining_amount,due_date,status,minimum_payment").neq("status", "Cancelled"),
    db.from("shopping_items").select("id,item,estimated_price,priority,planned_date,status").in("status", ["Considering", "Planned", "Ordered"]),
    getHabits(db, today),
    db.from("activity_logs").select("id,type,description,created_at").order("created_at", { ascending: false }).limit(8),
    db.from("calendar_events").select("id,title,start_time").gte("start_time", today).order("start_time").limit(5),
  ]);
  const failed = [todayT, overdueT, doneT, goals, miles, inc, exp, bud, debts, shop, acts, events].some((r) => r.error);
  if (failed) throw new Error("Could not load your dashboard. Please try again.");

  const doneByDay = new Map<string, number>();
  (doneT.data ?? []).forEach((r) => { const d = localDay(r.completed_at as string, timezone); doneByDay.set(d, (doneByDay.get(d) ?? 0) + 1); });
  const completedByDay = Array.from({ length: 14 }, (_, i) => { const d = addDays(today, i - 13); return { label: d.slice(5), Completed: doneByDay.get(d) ?? 0 }; });

  const months = Array.from({ length: 6 }, (_, i) => addMonths(from6, i));
  const sumMonth = (rows: { date: string; amount: unknown }[] | null, m: string) => (rows ?? []).filter((r) => r.date.startsWith(m.slice(0, 7))).reduce((a, r) => a + num(r.amount), 0);
  const trend = months.map((m) => { const i = sumMonth(inc.data, m), e = sumMonth(exp.data, m); return { label: shortMonth(m), Income: i, Expenses: e, Savings: i - e }; });
  const monthExp = (exp.data ?? []).filter((r) => r.date.startsWith(thisMonth.slice(0, 7)));
  const spentBy = (c: string) => monthExp.filter((r) => r.category === c).reduce((a, r) => a + num(r.amount), 0);

  return {
    ctx, todayTasks: (todayT.data ?? []) as DashTask[], overdueTasks: (overdueT.data ?? []) as DashTask[], overdueTaskCount: overdueT.count ?? 0, completedByDay,
    goals: (goals.data ?? []).map((g) => ({ ...g, progress_percentage: num(g.progress_percentage) })) as Goal[],
    milestones: (miles.data ?? []) as DashMilestone[],
    finance: {
      months: trend, income: trend[5].Income, expenses: trend[5].Expenses,
      categories: foldTop(groupTotals(monthExp, (r) => r.category, (r) => num(r.amount))),
      budgets: (bud.data ?? []).map((b) => ({ category: b.category as string, amount: num(b.amount), spent: spentBy(b.category as string) })),
    },
    debts: (debts.data ?? []).map((d) => ({ ...d, original_amount: num(d.original_amount), remaining_amount: num(d.remaining_amount), minimum_payment: d.minimum_payment == null ? null : num(d.minimum_payment) })) as DashDebt[],
    shopping: (shop.data ?? []).map((s) => ({ ...s, estimated_price: s.estimated_price == null ? null : num(s.estimated_price) })) as DashItem[],
    habits, activity: (acts.data ?? []) as DashboardData["activity"], events: (events.data ?? []) as DashboardData["events"],
  };
}
