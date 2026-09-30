const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const localDate = (d = new Date()) => d.toLocaleDateString("en-CA"); // yyyy-MM-dd in the viewer's timezone
export const shiftDate = (d: string, days: number) => new Date(toMs(d) + days * DAY).toISOString().slice(0, 10);

/** Consecutive days ending today; if today isn't done yet, the streak still counts up to yesterday. */
export function currentStreak(dates: string[], today: string) {
  const set = new Set(dates);
  let day = set.has(today) ? today : shiftDate(today, -1), n = 0;
  while (set.has(day)) { n++; day = shiftDate(day, -1); }
  return n;
}
export function longestStreak(dates: string[]) {
  const ms = [...new Set(dates)].map(toMs).sort((a, b) => a - b);
  let best = 0, run = 0;
  ms.forEach((m, i) => { run = i > 0 && m - ms[i - 1] === DAY ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}
/** Percent of the last `days` days (ending today) that were completed. */
export function completionRate(dates: string[], today: string, days = 30) {
  const set = new Set(dates);
  let hit = 0;
  for (let i = 0; i < days; i++) if (set.has(shiftDate(today, -i))) hit++;
  return (hit / days) * 100;
}
