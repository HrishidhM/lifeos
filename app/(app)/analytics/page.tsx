import AnalyticsView from "@/features/analytics/AnalyticsView";
import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/services/profile";

export default async function AnalyticsPage() {
  const ctx = await getContext(await createClient());
  return (<div className="space-y-4"><h1 className="text-2xl font-bold">Analytics</h1><AnalyticsView today={ctx.today} currency={ctx.currency} timezone={ctx.timezone} /></div>);
}
