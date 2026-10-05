"use client";
import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export function Card({ title, href, linkLabel = "Open", action, children, className = "", id, danger = false }: {
  danger?: boolean; title?: string; href?: string; linkLabel?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section id={id} className={`rounded-lg border p-4 ${danger ? "border-danger/50 bg-danger/5" : "border-line bg-panel"} ${className}`} aria-label={title}>
      {(title || href || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          <div className="flex items-center gap-2">{action}{href && <Link href={href} className="text-xs text-accent underline">{linkLabel}</Link>}</div>
        </header>
      )}
      {children}
    </section>
  );
}

type Tone = "danger" | "warn" | "ok" | "muted";
const tones: Record<Tone, string> = {
  danger: "border-danger/40 bg-danger/10 text-danger", warn: "border-warn/40 bg-warn/10 text-warn",
  ok: "border-accent/40 bg-accent/10 text-accent", muted: "border-line text-muted",
};
/** Status is always icon + text, never colour alone. */
export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  const Icon = tone === "danger" ? AlertTriangle : tone === "warn" ? Clock : tone === "ok" ? CheckCircle2 : null;
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{Icon && <Icon size={12} aria-hidden />}{children}</span>;
}

export function ProgressBar({ value, label, tone = "ok", className = "" }: { value: number; label: string; tone?: Tone; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const fill = tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-accent";
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} className={`h-2 overflow-hidden rounded bg-line ${className}`}>
      <div className={`h-full rounded ${fill} transition-[width] duration-300 motion-reduce:transition-none`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === value);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault(); onChange(tabs[(next + tabs.length) % tabs.length].id);
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex flex-wrap gap-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)}
          className={`rounded-md border px-3 py-1 text-sm ${value === t.id ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line bg-panel text-muted hover:text-ink"}`}>
          {t.label}{t.count !== undefined && <span className="ml-1 text-xs opacity-80">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title} className="m-auto w-[min(34rem,94vw)] rounded-lg border border-line bg-panel p-4 text-ink backdrop:bg-black/50">
      <h2 className="mb-3 font-semibold">{title}</h2>{open && children}
    </dialog>
  );
}

export function Stat({ label, value, sub, href, tone }: { label: string; value: ReactNode; sub?: ReactNode; href?: string; tone?: Tone }) {
  const body = (
    <div className={`h-full rounded-lg border p-4 transition-colors ${tone === "danger" ? "border-danger/50 bg-danger/5" : "border-line bg-panel"} ${href ? "hover:border-accent" : ""}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "danger" ? "text-danger" : ""}`}>{value}</p>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Empty({ children }: { children: ReactNode }) { return <p className="text-sm text-muted">{children}</p>; }

export function Delta({ value, goodWhenUp, label }: { value: number | null; goodWhenUp: boolean; label: string }) {
  if (value === null) return <span>No data for {label}</span>;
  const up = value >= 0, good = up === goodWhenUp;
  return <span className={good ? "text-accent" : "text-danger"}>{up ? "▲" : "▼"} {Math.abs(Math.round(value))}% vs {label}</span>;
}
