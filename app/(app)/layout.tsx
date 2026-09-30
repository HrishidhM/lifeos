import { redirect } from "next/navigation";
import DeadlineBanner from "@/components/DeadlineBanner";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email ?? ""} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 max-w-4xl"><Topbar />
        <DeadlineBanner />
        {children}</main>
    </div>
  );
}
