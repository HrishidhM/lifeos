const MS = 86_400_000;
export const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Today's date (yyyy-MM-dd) in the given IANA timezone. */
export function todayIn(tz?: string, now = new Date()) {
  try { return now.toLocaleDateString("en-CA", { timeZone: tz }); } catch { return now.toISOString().slice(0, 10); }
}
export function hourIn(tz?: string, now = new Date()) {
  try { return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now)); } catch { return now.getUTCHours(); }
}
/** yyyy-MM-dd of a timestamp as seen in `tz`. */
export function localDay(ts: string, tz?: string) { return todayIn(tz, new Date(ts)); }

export const addDays = (d: string, n: number) => new Date(parse(d) + n * MS).toISOString().slice(0, 10);
/** Whole days from b to a (a - b). */
export const diffDays = (a: string, b: string) => Math.round((parse(a) - parse(b)) / MS);
export const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
export function addMonths(ms: string, n: number) {
  const y = Number(ms.slice(0, 4)), m = Number(ms.slice(5, 7));
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
export function daysInMonth(ms: string) { return diffDays(addMonths(ms, 1), monthStart(ms)); }
export const isValidMonth = (m: string | undefined): m is string => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const monthLabel = (ms: string) => new Date(parse(ms)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
export const shortMonth = (ms: string) => new Date(parse(ms)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
export const shortDate = (d: string) => new Date(parse(d)).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
export const longDate = (d: string) => new Date(parse(d)).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
