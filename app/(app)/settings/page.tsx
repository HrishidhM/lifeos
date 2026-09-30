import SettingsView from "@/components/SettingsView";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const db = await createClient();
  const [{ data: { user } }, { data: p }] = await Promise.all([db.auth.getUser(), db.from("profiles").select("full_name,currency,timezone,week_start,default_task_duration").maybeSingle()]);
  const profile = p ?? { full_name: "", currency: "INR", timezone: "Asia/Kolkata", week_start: 1, default_task_duration: 30 };
  return (<div className="space-y-4"><h1 className="text-2xl font-bold">Settings</h1><SettingsView profile={profile} email={user?.email ?? ""} /></div>);
}
