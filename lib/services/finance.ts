import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logActivity } from "./activity";
import { addMonths, shortMonth } from "@/utils/dates";
import { getContext } from "./profile";

export const EXPENSE_CATEGORIES = ["Food", "Transport", "Rent", "Bills", "Education", "Shopping", "Entertainment", "Health", "Travel", "Other"] as const;
export const INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Investments", "Gift", "Other"] as const;
export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank transfer", "Other"] as const;

const amount = z.number({ message: "Enter an amount" }).positive("Amount must be above 0").max(1e10, "Amount is too large");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");
const text = z.string().trim().optional().transform((v) => v || undefined);

export const incomeSchema = z.object({ source: z.string().trim().min(1, "Source is required"), amount, date, category: z.enum(INCOME_CATEGORIES).default("Other"), recurring: z.boolean().default(false), notes: text });
export const expenseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"), amount, date, category: z.enum(EXPENSE_CATEGORIES),
  payment_method: text, recurring: z.boolean().default(false), notes: text,
});
export const budgetSchema = z.object({ category: z.enum(EXPENSE_CATEGORIES), amount });

export type IncomeRow = { id: string; source: string; amount: number; date: string; category: string | null; recurring: boolean; notes: string | null };
export type ExpenseRow = { id: string; title: string; amount: number; date: string; category: string; payment_method: string | null; recurring: boolean; notes: string | null };
export type BudgetRow = { id: string; category: string; amount: number };
export type FinancePage = Awaited<ReturnType<typeof getFinancePage>>;

const fail = (m: string): never => { throw new Error(m); };
const userId = async (db: SupabaseClient) => (await db.auth.getUser()).data.user?.id ?? fail("Not signed in");
const n = (v: unknown) => Number(v ?? 0);

/** One page of finance data: the month, a 6-month trend, and the previous month for comparisons. */
export async function getFinancePage(db: SupabaseClient, month: string) {
  const ctx = await getContext(db);
  const next = addMonths(month, 1), prev = addMonths(month, -1), trendFrom = addMonths(month, -5);
  const [inc, exp, bud, prevBud] = await Promise.all([
    db.from("income").select("id,source,amount,date,category,recurring,notes").gte("date", trendFrom).lt("date", next).order("date", { ascending: false }),
    db.from("expenses").select("id,title,amount,date,category,payment_method,recurring,notes").gte("date", trendFrom).lt("date", next).order("date", { ascending: false }),
    db.from("budgets").select("id,category,amount").eq("month", month),
    db.from("budgets").select("id,category,amount").eq("month", prev),
  ]);
  if (inc.error || exp.error || bud.error || prevBud.error) fail("Could not load finance data.");
  const income = (inc.data ?? []).map((r) => ({ ...r, amount: n(r.amount) })) as IncomeRow[];
  const expenses = (exp.data ?? []).map((r) => ({ ...r, amount: n(r.amount) })) as ExpenseRow[];
  const inMonth = (d: string, m: string) => d.startsWith(m.slice(0, 7));
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(trendFrom, i), Income = income.filter((r) => inMonth(r.date, m)).reduce((a, r) => a + r.amount, 0), Expenses = expenses.filter((r) => inMonth(r.date, m)).reduce((a, r) => a + r.amount, 0);
    return { month: m, label: shortMonth(m), Income, Expenses, Savings: Income - Expenses };
  });
  const toBud = (rows: { id: string; category: string; amount: unknown }[] | null) => (rows ?? []).map((b) => ({ ...b, amount: n(b.amount) })) as BudgetRow[];
  return {
    ctx, trend, income: income.filter((r) => inMonth(r.date, month)), expenses: expenses.filter((r) => inMonth(r.date, month)),
    prev: trend[4], budgets: toBud(bud.data), prevBudgets: toBud(prevBud.data),
  };
}

export async function createIncome(db: SupabaseClient, input: z.input<typeof incomeSchema>) {
  const v = incomeSchema.parse(input);
  const { data, error } = await db.from("income").insert({ ...v, user_id: await userId(db) }).select("id").single();
  if (error) fail("Could not save income.");
  await logActivity(db, { type: "INCOME_ADDED", entityType: "income", entityId: data!.id, description: `Added income from ${v.source}` });
}
export async function createExpense(db: SupabaseClient, input: z.input<typeof expenseSchema>) {
  const v = expenseSchema.parse(input);
  const { data, error } = await db.from("expenses").insert({ ...v, user_id: await userId(db) }).select("id").single();
  if (error) fail("Could not save expense.");
  await logActivity(db, { type: "EXPENSE_ADDED", entityType: "expense", entityId: data!.id, description: `Added expense "${v.title}"` });
}
/** Edits take the full form so optional fields can be cleared (null) instead of left stale. */
export async function updateIncome(db: SupabaseClient, id: string, input: z.input<typeof incomeSchema>) {
  const v = incomeSchema.parse(input);
  if ((await db.from("income").update({ ...v, notes: v.notes ?? null }).eq("id", id)).error) fail("Could not update income.");
}
export async function updateExpense(db: SupabaseClient, id: string, input: z.input<typeof expenseSchema>) {
  const v = expenseSchema.parse(input);
  if ((await db.from("expenses").update({ ...v, payment_method: v.payment_method ?? null, notes: v.notes ?? null }).eq("id", id)).error) fail("Could not update expense.");
}
export async function deleteIncome(db: SupabaseClient, id: string) { if ((await db.from("income").delete().eq("id", id)).error) fail("Could not delete income."); }
export async function deleteExpense(db: SupabaseClient, id: string) { if ((await db.from("expenses").delete().eq("id", id)).error) fail("Could not delete expense."); }

export async function setBudget(db: SupabaseClient, monthStart: string, input: z.input<typeof budgetSchema>) {
  const v = budgetSchema.parse(input);
  const { error } = await db.from("budgets").upsert({ ...v, month: monthStart, user_id: await userId(db) }, { onConflict: "user_id,category,month" });
  if (error) fail("Could not save budget.");
}
export async function deleteBudget(db: SupabaseClient, id: string) { if ((await db.from("budgets").delete().eq("id", id)).error) fail("Could not delete budget."); }
/** Copy last month's budgets forward without overwriting any already set for this month. */
export async function copyBudgets(db: SupabaseClient, from: BudgetRow[], toMonth: string) {
  if (!from.length) fail("Last month has no budgets to copy.");
  const uid = await userId(db);
  const { error } = await db.from("budgets").upsert(from.map((b) => ({ category: b.category, amount: b.amount, month: toMonth, user_id: uid })), { onConflict: "user_id,category,month", ignoreDuplicates: true });
  if (error) fail("Could not copy budgets.");
}
