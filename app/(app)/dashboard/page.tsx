import DashboardView from "@/features/dashboard/DashboardView";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/services/dashboard";

export default async function Dashboard() {
  return <DashboardView data={await getDashboardData(await createClient())} />;
}
