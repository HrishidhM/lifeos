import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logActivity } from "./activity";

const money = (label: string) => z.number({ message: `Enter ${label}` }).positive(`${label} must be above 0`).max(1e10, "Amount is too large");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");

export const debtSchema = z.object({
  creditor: z.string().trim().min(1, "Creditor is required"),
  original_amount: money("the amount"),
  interest_rate: z.number().min(0, "Interest cannot be negative").max(100, "Interest looks too high").default(0),
  minimum_payment: z.number().min(0, "Cannot be negative").optional(),
  due_date: date.optional(),
});
export type DebtInput = z.infer<typeof debtSchema>;
export type Debt = {
  id: string; creditor: string; original_amount: number; remaining_amount: number;
  interest_rate: number; minimum_payment: number | null; due_date: string | null; status: string;
};
export type Payment = { id: string; debt_id: string; amount: number; payment_date: string };

const fail = (m: string): never => { throw new Error(m); };
const userId = async (db: SupabaseClient) => (await db.auth.getUser()).data.user?.id ?? fail("Not signed in");
const nums = <T extends object>(rows: T[], keys: (keyof T)[]) =>
  rows.map((r) => { const o = { ...r } as Record<string, unknown>; keys.forEach((k) => { if (o[k as string] != null) o[k as string] = Number(o[k as string]); }); return o as T; });

export async function getDebts(db: SupabaseClient): Promise<Debt[]> {
  const { data, error } = await db.from("debts").select("*").order("due_date", { nullsFirst: false });
  if (error) fail("Could not load debts.");
  return nums(data as Debt[], ["original_amount", "remaining_amount", "interest_rate", "minimum_payment"]);
}
export async function getPayments(db: SupabaseClient, limit = 30): Promise<Payment[]> {
  const { data, error } = await db.from("debt_payments").select("id,debt_id,amount,payment_date").order("payment_date", { ascending: false }).limit(limit);
  if (error) fail("Could not load payments.");
  return nums(data as Payment[], ["amount"]);
}
export async function createDebt(db: SupabaseClient, input: DebtInput) {
  const v = debtSchema.parse(input);
  const { error } = await db.from("debts").insert({ ...v, remaining_amount: v.original_amount, start_date: new Date().toISOString().slice(0, 10), user_id: await userId(db) });
  if (error) fail("Could not save debt.");
}
/** The database trigger lowers remaining_amount (never below 0) and marks the debt Paid at 0. */
export async function recordPayment(db: SupabaseClient, debt: Debt, amount: number, paymentDate: string) {
  const a = money("the payment").parse(amount);
  date.parse(paymentDate);
  if (debt.status === "Paid") fail("This debt is already paid off.");
  if (a > debt.remaining_amount) fail(`Payment is more than the remaining ${debt.remaining_amount}.`);
  const { error } = await db.from("debt_payments").insert({ debt_id: debt.id, amount: a, payment_date: paymentDate, user_id: await userId(db) });
  if (error) fail("Could not record payment.");
  await logActivity(db, { type: "DEBT_PAYMENT", entityType: "debt", entityId: debt.id, description: `Paid ${a} toward ${debt.creditor}` });
}
export async function deleteDebt(db: SupabaseClient, id: string) {
  if ((await db.from("debts").delete().eq("id", id)).error) fail("Could not delete debt.");
}
