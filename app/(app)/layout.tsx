import { redirect } from "next/navigation";
import DeadlineBanner from "@/components/DeadlineBanner";
import Quote from "@/components/Quote";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { randomQuoteIndex } from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const start = randomQuoteIndex();
  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email ?? ""} />
      <main className="min-w-0 max-w-6xl flex-1 p-4 pb-20 md:p-8 md:pb-8">
        <Topbar />
        <Quote start={start} variant="banner" />
        <DeadlineBanner />
        {children}
      </main>
      <Quote start={start} variant="rail" />
    </div>
  );
}
