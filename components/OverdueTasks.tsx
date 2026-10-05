"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cancelTask, completeTask, rescheduleTask } from "@/lib/services/tasks";
import { MAX_RESCHEDULES, rescheduleInfo } from "@/utils/tasks";

export type OverdueTask = {
  id: string; title: string; priority: string; due_date: string | null; goal_id?: string | null;
  reschedule_count?: number | null; last_rescheduled_at?: string | null;
  original_due_date?: string | null; last_reschedule_reason?: string | null;
};

function stamp(iso: string, tz: string) {
  try { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(iso)); }
  catch { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; }
}

export default function OverdueTasks({ tasks, goals, today, timezone }: { tasks: OverdueTask[]; goals: { id: string; title: string }[]; today: string; timezone: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<OverdueTask | null>(null);
  const [cancelling, setCancelling] = useState<OverdueTask | null>(null);
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const goalName = (id?: string | null) => goals.find((g) => g.id === id)?.title;

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setError(null); setBusy(true);
    try { await fn(); after?.(); } catch (e) { setError((e as Error).message); }
    setBusy(false); router.refresh();
  }
  function openEdit(t: OverdueTask) { setDate(today); setReason(""); setError(null); setEditing(t); }

  const info = editing ? rescheduleInfo({ ...editing, status: "Todo" }, today) : null;

  return (
    <section id="overdue" aria-labelledby="overdue-h" className={`scroll-mt-4 space-y-3 rounded-lg border p-4 ${tasks.length ? "border-danger/50 bg-danger/5" : "border-line bg-panel"}`}>
      <div>
        <h2 id="overdue-h" className="flex items-center gap-2 font-semibold"><CalendarClock size={18} aria-hidden /> Overdue tasks ({tasks.length})</h2>
        <p className="text-sm text-muted">Changing the due date of an overdue task is an <strong>overdue edit</strong>. Each task allows at most {MAX_RESCHEDULES} of them, and every edit is recorded. After that you can only complete or cancel the task.</p>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {tasks.length === 0 ? <p className="text-sm text-muted">Nothing is overdue. Nice work.</p> : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const i = rescheduleInfo({ ...t, status: "Todo" }, today);
            return (
              <li key={t.id} className="row-overdue rounded-lg border border-line bg-panel p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  <Badge tone="danger">Overdue by {i.overdueDays}d</Badge>
                  <span className="text-xs text-muted">{t.priority}{goalName(t.goal_id) ? ` · ${goalName(t.goal_id)}` : ""}</span>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div><dt className="inline text-muted">Due: </dt><dd className="inline">{t.due_date}</dd></div>
                  <div><dt className="inline text-muted">Originally due: </dt><dd className="inline">{t.original_due_date ?? t.due_date}</dd></div>
                  <div className="flex items-center gap-2"><dt className="text-muted">Date edits used:</dt>
                    <dd className="flex items-center gap-1.5"><span aria-hidden className="tracking-widest">{"●".repeat(i.used)}{"○".repeat(i.remaining)}</span><span className="font-medium">{i.used} of {MAX_RESCHEDULES} date edits used</span></dd></div>
                  <div><dt className="inline text-muted">Last edited: </dt><dd className="inline">{t.last_rescheduled_at ? stamp(t.last_rescheduled_at, timezone) : "Never edited"}</dd></div>
                  {t.last_reschedule_reason && <div className="sm:col-span-2"><dt className="inline text-muted">Last reason: </dt><dd className="inline">{t.last_reschedule_reason}</dd></div>}
                </dl>
                <div className="flex flex-wrap items-center gap-2">
                  {i.locked ? <Badge tone="danger">Date locked: no edits left</Badge>
                    : <button className="btn" disabled={busy} onClick={() => openEdit(t)}>Edit due date (attempt {i.nextAttempt} of {MAX_RESCHEDULES})</button>}
                  <button className="rounded-md border border-line px-3 py-1 text-sm" disabled={busy} onClick={() => run(() => completeTask(createClient(), t.id))}>Complete</button>
                  {i.locked && <button className="rounded-md border border-line px-3 py-1 text-sm text-danger" disabled={busy} onClick={() => setCancelling(t)}>Cancel task</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Overdue edit: change due date">
        {editing && info && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => rescheduleTask(createClient(), editing, date, reason), () => setEditing(null)); }}>
            <p className="text-sm"><strong>{editing.title}</strong> was due {editing.due_date}.</p>
            <p className="text-sm">This uses <strong>attempt {info.nextAttempt} of {MAX_RESCHEDULES}</strong>.</p>
            {info.isLast && <p role="alert" className="rounded-md border border-danger/50 bg-danger/5 p-2 text-sm text-danger">This is the last date edit. Afterwards the date is locked and the task can only be completed or cancelled.</p>}
            <label className="block text-sm">New due date<input type="date" className="input mt-1" min={today} value={date} onChange={(e) => setDate(e.target.value)} required /></label>
            <label className="block text-sm">Reason (optional)<input className="input mt-1" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why does the date need to move?" /></label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-md border border-line px-3 py-1 text-sm" onClick={() => setEditing(null)}>Keep current date</button>
              <button className="btn" disabled={busy || !date || date < today}>Save new date (uses attempt {info.nextAttempt} of {MAX_RESCHEDULES})</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel this task?">
        {cancelling && (
          <div className="space-y-3">
            <p className="text-sm">&ldquo;{cancelling.title}&rdquo; will be marked as cancelled.</p>
            <div className="flex justify-end gap-2">
              <button className="rounded-md border border-line px-3 py-1 text-sm" onClick={() => setCancelling(null)}>Keep task</button>
              <button className="btn" disabled={busy} onClick={() => run(() => cancelTask(createClient(), cancelling.id, cancelling.title), () => setCancelling(null))}>Cancel task</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
