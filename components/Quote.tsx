"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { QUOTES } from "@/lib/quotes";

/** Rotates every 12s, pauses on hover/focus, and starts from a server-chosen quote so the first paint matches. */
export default function Quote({ start, variant }: { start: number; variant: "rail" | "banner" }) {
  const [i, setI] = useState(start % QUOTES.length), [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 12_000);
    return () => clearInterval(t);
  }, [paused]);
  const next = () => setI((n) => (n + 1) % QUOTES.length);
  const handlers = { onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false), onFocus: () => setPaused(true), onBlur: () => setPaused(false) };

  if (variant === "banner") {
    return (
      <aside aria-label="Motivation" {...handlers} className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2 2xl:hidden">
        <p key={i} className="quote-in flex-1 text-sm font-medium italic">“{QUOTES[i]}”</p>
        <button onClick={next} aria-label="Show another quote" className="text-muted hover:text-ink"><RefreshCw size={14} /></button>
      </aside>
    );
  }
  return (
    <aside aria-label="Motivation" {...handlers} className="sticky top-8 hidden w-64 shrink-0 self-start p-4 2xl:block">
      <div className="border-l-4 border-accent pl-4">
        <p key={i} className="quote-in text-xl font-bold leading-snug">“{QUOTES[i]}”</p>
      </div>
      <button onClick={next} className="mt-4 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><RefreshCw size={12} aria-hidden />Another one</button>
    </aside>
  );
}
