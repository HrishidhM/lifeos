import { addDays, addMonths, diffDays, localDay, parse } from "./dates";
import { currentStreak, longestStreak } from "./streak";

export type Gran = "day" | "week" | "month";
export type Preset = "7d" | "30d" | "90d" | "6m" | "1y" | "custom";
export const PRESETS: { id: Preset; label: string }[] = [
  { id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "90d", label: "90 days" },
  { id: "6m", label: "6 months" }, { id: "1y", label: "1 year" }, { id: "custom", label: "Custom" },
];
const PRESET_DAYS: Record<Exclude<Preset, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90, "6m": 182, "1y": 365 };

export function rangeFor(p: Preset, today: string, custom?: { from: string; to: string }) {
  if (p === "custom" && custom) return custom;
  return { from: addDays(today, -(PRESET_DAYS[p === "custom" ? "30d" : p] - 1)), to: today };
}
export const granularityFor = (from: string, to: string): Gran => { const n = diffDays(to, from) + 1; return n <= 31 ? "day" : n <= 180 ? "week" : "month"; };
export const bucketStart = (d: string, g: Gran) => (g === "day" ? d : g === "month" ? `${d.slice(0, 7)}-01` : addDays(d, -((new Date(parse(d)).getUTCDay() + 6) % 7)));
export function bucketList(from: string, to: string, g: Gran) {
  const out: string[] = [];
  for (let cur = bucketStart(from, g), end = bucketStart(to, g); cur <= end; cur = g === "day" ? addDays(cur, 1) : g === "week" ? addDays(cur, 7) : addMonths(cur, 1)) out.push(cur);
  return out;
}
export const bucketLabel = (b: string, g: Gran) =>
  new Date(parse(b)).toLocaleDateString("en-US", g === "month" ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
export function sumBy(rows: { date: string; amount: number }[], buckets: string[], g: Gran) {
  const m = new Map(buckets.map((b) => [b, 0]));
  rows.forEach((r) => { const k = bucketStart(r.date, g); if (m.has(k)) m.set(k, (m.get(k) ?? 0) + r.amount); });
  return buckets.map((b) => m.get(b) ?? 0);
}
export function groupTotals<T>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + val(r)));
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
/** Keep the top n categories and fold the rest into "Other" (the palette has 8 fixed hues). */
export function foldTop(items: { name: string; value: number }[], n = 7) {
  if (items.length <= n + 1) return items;
  const rest = items.slice(n).reduce((a, b) => a + b.value, 0);
  return [...items.slice(0, n), { name: FOLDED, value: rest }];
}
export const FOLDED = "Smaller categories";
/** Rows that belong to a (possibly folded) donut slice. */
export function rowsInBucket<T extends { category: string }>(rows: T[], buckets: { name: string }[], name: string) {
  if (name !== FOLDED) return rows.filter((r) => r.category === name);
  const shown = new Set(buckets.filter((b) => b.name !== FOLDED).map((b) => b.name));
  return rows.filter((r) => !shown.has(r.category));
}

export type TaskRow = { id: string; status: string; priority: string; category: string | null; due_date: string | null; completed_at: string | null; estimated_minutes: number | null; actual_minutes: number | null; goal_id: string | null };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function productivityStats(due: TaskRow[], done: TaskRow[], from: string, to: string, tz: string) {
  const g = granularityFor(from, to), buckets = bucketList(from, to, g);
  const doneInRange = done.filter((t) => { const d = localDay(t.completed_at!, tz); return d >= from && d <= to; });
  const completedDue = due.filter((t) => t.status === "Completed").length;
  const mins = doneInRange.map((t) => t.actual_minutes ?? t.estimated_minutes).filter((x): x is number => x != null);
  const weekdays = WEEKDAYS.map((name) => ({ name, value: 0 }));
  doneInRange.forEach((t) => { weekdays[(new Date(parse(localDay(t.completed_at!, tz))).getUTCDay() + 6) % 7].value++; });
  const completedSeries = sumBy(doneInRange.map((t) => ({ date: localDay(t.completed_at!, tz), amount: 1 })), buckets, g);
  const dueSeries = sumBy(due.map((t) => ({ date: t.due_date!, amount: 1 })), buckets, g);
  return {
    gran: g, completedCount: doneInRange.length, dueCount: due.length,
    completionPct: due.length ? (completedDue / due.length) * 100 : 0,
    avgMinutes: mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : null,
    byPriority: ["Critical", "High", "Medium", "Low"].map((name) => ({ name, value: due.filter((t) => t.priority === name).length })),
    byCategory: groupTotals(due, (t) => t.category || "Uncategorized", () => 1),
    weekdays, bestDay: weekdays.reduce((a, b) => (b.value > a.value ? b : a)),
    series: buckets.map((b, i) => ({ label: bucketLabel(b, g), Completed: completedSeries[i], Due: dueSeries[i] })),
  };
}

export type HabitRow = { id: string; name: string; start_date: string };
export function habitStats(habits: HabitRow[], completions: { habit_id: string; completed_on: string }[], from: string, to: string, today: string) {
  const end = to > today ? today : to, g = granularityFor(from, to), buckets = bucketList(from, to, g);
  const days = Math.max(0, diffDays(end, from) + 1);
  const per = habits.map((h) => {
    const dates = completions.filter((c) => c.habit_id === h.id).map((c) => c.completed_on);
    const start = h.start_date > from ? h.start_date : from;
    const active = Math.max(0, diffDays(end, start) + 1);
    return { id: h.id, name: h.name, done: dates.length, active, rate: active ? (dates.length / active) * 100 : 0, current: currentStreak(dates, end), longest: longestStreak(dates) };
  });
  const perDay = new Map<string, number>();
  completions.forEach((c) => perDay.set(c.completed_on, (perDay.get(c.completed_on) ?? 0) + 1));
  const total = completions.length, possible = per.reduce((a, h) => a + h.active, 0);
  const series = buckets.map((b) => {
    const next = g === "day" ? addDays(b, 1) : g === "week" ? addDays(b, 7) : addMonths(b, 1);
    const lo = b < from ? from : b, hi = addDays(next, -1) > end ? end : addDays(next, -1);
    const span = Math.max(0, diffDays(hi, lo) + 1);
    let done = 0; for (let i = 0; i < span; i++) done += perDay.get(addDays(lo, i)) ?? 0;
    return { label: bucketLabel(b, g), Consistency: span && habits.length ? Math.round((done / (span * habits.length)) * 100) : 0 };
  });
  const heatStart = diffDays(to, from) + 1 > 182 ? addDays(to, -181) : from;
  const heat = Array.from({ length: diffDays(to, heatStart) + 1 }, (_, i) => {
    const date = addDays(heatStart, i), n = perDay.get(date) ?? 0;
    return { date, value: habits.length ? n / habits.length : 0, label: `${date}: ${n} of ${habits.length} habits` };
  });
  return { per, days, rate: possible ? (total / possible) * 100 : 0, series, heat, bestStreak: Math.max(0, ...per.map((h) => h.current)), longest: Math.max(0, ...per.map((h) => h.longest)) };
}
