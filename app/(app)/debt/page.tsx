import DebtView from "@/components/DebtView";
import { createClient } from "@/lib/supabase/server";
import { getDebts, getPayments } from "@/lib/services/debt";

export default async function DebtPage() {
  const db = await createClient();
  try {
    const [debts, payments, prof] = await Promise.all([getDebts(db), getPayments(db), db.from("profiles").select("currency").maybeSingle()]);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Debt</h1>
        <DebtView debts={debts} payments={payments} currency={(prof.data?.currency as string | undefined) ?? "INR"} />
      </div>
    );
  } catch (e) {
    return <p role="alert" className="text-danger">{(e as Error).message}</p>;
  }
}
