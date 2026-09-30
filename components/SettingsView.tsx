"use client";
import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

type Profile = { full_name: string | null; currency: string; timezone: string; week_start: number; default_task_duration: number };
const TABLES = ["tasks", "goals", "goal_milestones", "habits", "habit_completions", "income", "expenses", "budgets", "debts", "debt_payments", "shopping_items", "notes"];
const schema = z.object({ full_name: z.string().trim(), currency: z.string().length(3, "Use a 3-letter code, e.g. INR"), timezone: z.string().min(1), week_start: z.number().int().min(0).max(6), default_task_duration: z.number().int().positive("Must be above 0") });

function download(name: string, text: string, type: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]), esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};

export default function SettingsView({ profile, email }: { profile: Profile; email: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const p = schema.safeParse({ full_name: f.get("full_name"), currency: String(f.get("currency")).toUpperCase(), timezone: f.get("timezone"), week_start: Number(f.get("week_start")), default_task_duration: Number(f.get("dur")) });
    if (!p.success) return setMsg({ ok: false, text: p.error.issues[0].message });
    const db = createClient(), uid = (await db.auth.getUser()).data.user?.id;
    const { error } = await db.from("profiles").update(p.data).eq("user_id", uid ?? "");
    setMsg(error ? { ok: false, text: "Could not save settings." } : { ok: true, text: "Settings saved." });
  }
  async function exportAll(kind: "json" | "csv") {
    const db = createClient(), out: Record<string, unknown[]> = {};
    for (const t of TABLES) { const { data, error } = await db.from(t).select("*"); if (error) return setMsg({ ok: false, text: `Could not export ${t}.` }); out[t] = data; }
    if (kind === "json") download("lifeos-export.json", JSON.stringify(out, null, 2), "application/json");
    else TABLES.forEach((t) => out[t].length && download(`${t}.csv`, toCsv(out[t] as Record<string, unknown>[]), "text/csv"));
    setMsg({ ok: true, text: "Export ready." });
  }
  return (
    <div className="space-y-6 max-w-lg">
      <form onSubmit={save} className="bg-panel border border-line rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Profile and preferences</h2>
        <p className="text-sm text-muted">{email}</p>
        <label className="block text-sm">Name<input name="full_name" className="input mt-1" defaultValue={profile.full_name ?? ""} /></label>
        <label className="block text-sm">Currency (code)<input name="currency" className="input mt-1" defaultValue={profile.currency} maxLength={3} /></label>
        <label className="block text-sm">Timezone<input name="timezone" className="input mt-1" defaultValue={profile.timezone} /></label>
        <label className="block text-sm">Week starts on<select name="week_start" className="input mt-1" defaultValue={profile.week_start}><option value={1}>Monday</option><option value={0}>Sunday</option><option value={6}>Saturday</option></select></label>
        <label className="block text-sm">Default task minutes<input name="dur" type="number" min="1" className="input mt-1" defaultValue={profile.default_task_duration} /></label>
        <button className="btn">Save</button>
      </form>
      <section className="bg-panel border border-line rounded-lg p-4 space-y-3"><h2 className="font-semibold">Export your data</h2>
        <div className="flex gap-2"><button className="btn" onClick={() => exportAll("json")}>Download JSON</button><button className="btn" onClick={() => exportAll("csv")}>Download CSVs</button></div></section>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-accent" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
