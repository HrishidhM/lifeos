import FinanceView from "@/features/finance/FinanceView";
import { createClient } from "@/lib/supabase/server";
import { getFinancePage } from "@/lib/services/finance";
import { getContext } from "@/lib/services/profile";
import { isValidMonth, monthStart } from "@/utils/dates";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const db = await createClient();
  const month = isValidMonth(m) ? `${m}-01` : monthStart((await getContext(db)).today);
  return (<div className="space-y-4"><h1 className="text-2xl font-bold">Finance</h1><FinanceView data={await getFinancePage(db, month)} month={month} /></div>);
}
