"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CheckSquare, Target, Wallet, Landmark, Repeat, ShoppingBag, Sun, CalendarDays, BarChart3, StickyNote, Settings, LayoutDashboard, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/today", label: "Today", Icon: Sun },
  { href: "/tasks", label: "Tasks", Icon: CheckSquare },
  { href: "/goals", label: "Goals", Icon: Target },
  { href: "/habits", label: "Habits", Icon: Repeat },
  { href: "/finance", label: "Finance", Icon: Wallet },
  { href: "/debt", label: "Debt", Icon: Landmark },
  { href: "/shopping", label: "Shopping", Icon: ShoppingBag },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/notes", label: "Notes", Icon: StickyNote },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export default function Sidebar({ email }: { email: string }) {
  const path = usePathname();
  const router = useRouter();
  async function signOut() { await createClient().auth.signOut(); router.push("/login"); router.refresh(); }
  return (
    <>
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-line bg-panel p-4">
        <p className="text-lg font-bold mb-6">LifeOS</p>
        <nav aria-label="Main" className="flex-1 space-y-1">
          {links.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${path.startsWith(href) ? "bg-accent text-accent-ink font-semibold" : "text-muted hover:text-ink"}`}>
              <Icon size={16} aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted truncate mb-2">{email}</p>
        <button onClick={signOut} className="flex items-center gap-2 text-sm text-muted hover:text-ink"><LogOut size={16} aria-hidden /> Sign out</button>
      </aside>
      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-10 flex gap-5 overflow-x-auto px-3 border-t border-line bg-panel py-2">
        {links.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={`flex shrink-0 flex-col items-center text-xs ${path.startsWith(href) ? "text-accent font-semibold" : "text-muted"}`}>
            <Icon size={18} aria-hidden /> {label}
          </Link>
        ))}
        <button onClick={signOut} className="flex shrink-0 flex-col items-center text-xs text-muted"><LogOut size={18} aria-hidden /> Sign out</button>
      </nav>
    </>
  );
}
