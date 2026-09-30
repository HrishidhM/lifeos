import { addMonths, format, startOfMonth } from "date-fns";
import FinanceView from "@/components/FinanceView";
import { createClient } from "@/lib/supabase/server";
import { getFinanceMonth } from "@/lib/services/finance";

export default async function FinancePage() {
  const db = await createClient();
  const start = startOfMonth(new Date());
  const monthStart = format(start, "yyyy-MM-dd");
  try {
    const data = await getFinanceMonth(db, monthStart, format(addMonths(start, 1), "yyyy-MM-dd"));
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Finance</h1>
        <FinanceView {...data} monthStart={monthStart} monthLabel={format(start, "MMMM yyyy")} />
      </div>
    );
  } catch (e) {
    return <p role="alert" className="text-danger">{(e as Error).message}</p>;
  }
}
