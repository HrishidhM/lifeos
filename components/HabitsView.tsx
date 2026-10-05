"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createHabit, deleteHabit, toggleHabit, type Habit } from "@/lib/services/habits";
import { completionRate, currentStreak, longestStreak, shiftDate } from "@/utils/streak";

export default function HabitsView({ habits, today }: { habits: Habit[]; today: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
    const grid = Array.from({ length: 28 }, (_, i) => shiftDate(today, i - 27));
  async function run(fn: () => Promise<unknown>, form?: HTMLFormElement) {
    try { await fn(); setError(null); form?.reset(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }
  const doneToday = habits.filter((h) => h.dates.includes(today)).length;
  return (
    <div className="space-y-6">
      <form className="flex flex-wrap gap-2 bg-panel border border-line rounded-lg p-3" onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
        run(() => createHabit(createClient(), { name: String(f.get("name")), frequency: f.get("frequency") as "Daily" | "Weekly" | "Custom" }), form);
      }}>
        <label className="flex-1 min-w-40"><span className="sr-only">Habit name</span><input name="name" className="input" placeholder="New habit, e.g. Read 20 minutes" required /></label>
        <label><span className="sr-only">Frequency</span><select name="frequency" className="input"><option>Daily</option><option>Weekly</option><option>Custom</option></select></label>
        <button className="btn">Add habit</button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {habits.length === 0 ? <p className="text-sm text-muted">No habits yet. Add one above to start a streak.</p> : (
        <>
          <p className="text-sm text-muted">{doneToday} of {habits.length} habits done today</p>
          <ul className="space-y-3">{habits.map((h) => {
            const done = h.dates.includes(today);
            return (
              <li key={h.id} className="bg-panel border border-line rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={done} aria-label={`${h.name}: done today`} onChange={() => run(() => toggleHabit(createClient(), h, today, done))} />
                  <span className="flex-1 font-semibold">{h.name} <span className="text-xs text-muted font-normal">· {h.frequency}</span></span>
                  <button className="text-xs text-muted hover:text-danger" onClick={() => confirm(`Delete habit "${h.name}" and its history?`) && run(() => deleteHabit(createClient(), h.id))}>Delete</button>
                </div>
                <p className="text-sm text-muted">Current streak {currentStreak(h.dates, today)} · Longest {longestStreak(h.dates)} · 30-day rate {Math.round(completionRate(h.dates, today))}%</p>
                <ol className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }} aria-label="Last 28 days">
                  {grid.map((d) => { const on = h.dates.includes(d); return (
                    <li key={d} title={`${d}: ${on ? "done" : "not done"}`} aria-label={`${d}: ${on ? "done" : "not done"}`}
                      className={`h-5 rounded-sm border border-line text-[10px] leading-5 text-center ${on ? "bg-accent text-accent-ink" : ""}`}>{on ? "✓" : ""}</li>); })}
                </ol>
              </li>);
          })}</ul>
        </>)}
    </div>
  );
}
