import DebtView from "@/components/DebtView";
import { createClient } from "@/lib/supabase/server";
import { getDebts, getPayments } from "@/lib/services/debt";
import { getContext } from "@/lib/services/profile";

export default async function DebtPage() {
  const db = await createClient();
  const [debts, payments, ctx] = await Promise.all([getDebts(db), getPayments(db), getContext(db)]);
  return (<div className="space-y-4"><h1 className="text-2xl font-bold">Debt</h1><DebtView debts={debts} payments={payments} currency={ctx.currency} /></div>);
}
