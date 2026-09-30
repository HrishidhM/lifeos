import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logActivity } from "./activity";

export const EXPENSE_CATEGORIES = ["Food", "Transport", "Rent", "Bills", "Education", "Shopping", "Entertainment", "Health", "Travel", "Other"] as const;

const amount = z.number({ message: "Enter an amount" }).positive("Amount must be above 0").max(1e10, "Amount is too large");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");

export const incomeSchema = z.object({ source: z.string().trim().min(1, "Source is required"), amount, date, category: z.string().optional(), notes: z.string().optional() });
export const expenseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"), amount, date,
  category: z.enum(EXPENSE_CATEGORIES), payment_method: z.string().optional(), notes: z.string().optional(),
});
export const budgetSchema = z.object({ category: z.enum(EXPENSE_CATEGORIES), amount });

export type IncomeRow = { id: string; source: string; amount: number; date: string };
export type ExpenseRow = { id: string; title: string; amount: number; date: string; category: string };
export type BudgetRow = { id: string; category: string; amount: number };

const fail = (m: string): never => { throw new Error(m); };
const userId = async (db: SupabaseClient) => (await db.auth.getUser()).data.user?.id ?? fail("Not signed in");

/** monthStart is "yyyy-MM-01"; end is exclusive first day of next month. */
export async function getFinanceMonth(db: SupabaseClient, monthStart: string, nextMonthStart: string) {
  const [inc, exp, bud, prof] = await Promise.all([
    db.from("income").select("id,source,amount,date").gte("date", monthStart).lt("date", nextMonthStart).order("date", { ascending: false }),
    db.from("expenses").select("id,title,amount,date,category").gte("date", monthStart).lt("date", nextMonthStart).order("date", { ascending: false }),
    db.from("budgets").select("id,category,amount").eq("month", monthStart),
    db.from("profiles").select("currency").maybeSingle(),
  ]);
  if (inc.error || exp.error || bud.error) fail("Could not load finance data.");
  const num = <T extends { amount: number | string }>(r: T[]) => r.map((x) => ({ ...x, amount: Number(x.amount) }));
  return {
    income: num(inc.data as IncomeRow[]), expenses: num(exp.data as ExpenseRow[]), budgets: num(bud.data as BudgetRow[]),
    currency: (prof.data?.currency as string | undefined) ?? "INR",
  };
}

export async function createIncome(db: SupabaseClient, input: z.infer<typeof incomeSchema>) {
  const v = incomeSchema.parse(input);
  const { data, error } = await db.from("income").insert({ ...v, user_id: await userId(db) }).select("id").single();
  if (error) fail("Could not save income.");
  await logActivity(db, { type: "INCOME_ADDED", entityType: "income", entityId: data!.id, description: `Added income from ${v.source}` });
}
export async function createExpense(db: SupabaseClient, input: z.infer<typeof expenseSchema>) {
  const v = expenseSchema.parse(input);
  const { data, error } = await db.from("expenses").insert({ ...v, user_id: await userId(db) }).select("id").single();
  if (error) fail("Could not save expense.");
  await logActivity(db, { type: "EXPENSE_ADDED", entityType: "expense", entityId: data!.id, description: `Added expense "${v.title}"` });
}
export async function deleteIncome(db: SupabaseClient, id: string) {
  if ((await db.from("income").delete().eq("id", id)).error) fail("Could not delete income.");
}
export async function deleteExpense(db: SupabaseClient, id: string) {
  if ((await db.from("expenses").delete().eq("id", id)).error) fail("Could not delete expense.");
}
export async function setBudget(db: SupabaseClient, monthStart: string, input: z.infer<typeof budgetSchema>) {
  const v = budgetSchema.parse(input);
  const { error } = await db.from("budgets").upsert({ ...v, month: monthStart, user_id: await userId(db) }, { onConflict: "user_id,category,month" });
  if (error) fail("Could not save budget.");
}
export async function deleteBudget(db: SupabaseClient, id: string) {
  if ((await db.from("budgets").delete().eq("id", id)).error) fail("Could not delete budget.");
}
