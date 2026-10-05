import { describe, expect, it } from "vitest";
import { goalHealth, healthLabel, isStale } from "../utils/goals";
import { addMonths, daysInMonth, diffDays } from "../utils/dates";
import { bucketList, bucketStart, foldTop, granularityFor, rangeFor, sumBy } from "../utils/analytics";
import { compact } from "../utils/format";
import { onlyProvided } from "../utils/patch";
import { pctChange, projectedSpend } from "../utils/calc";
import { goalSchema } from "../lib/services/goals";
import { taskSchema } from "../lib/services/tasks";

const today = "2026-10-04";
describe("goal health", () => {
  it("flags overdue goals only when unfinished", () => {
    expect(goalHealth({ status: "In Progress", target_date: "2026-10-01" }, today)).toEqual({ state: "overdue", days: -3 });
    expect(healthLabel(goalHealth({ status: "In Progress", target_date: "2026-10-01" }, today))).toBe("Overdue by 3d");
    expect(goalHealth({ status: "Completed", target_date: "2026-10-01" }, today).state).toBe("done");
    expect(goalHealth({ status: "Cancelled", target_date: "2020-01-01" }, today).state).toBe("cancelled");
  });
  it("due today is due-soon, far future is ok, no deadline is ok", () => {
    expect(healthLabel(goalHealth({ status: "Not Started", target_date: today }, today))).toBe("Due today");
    expect(goalHealth({ status: "Not Started", target_date: "2026-11-30" }, today).state).toBe("ok");
    expect(goalHealth({ status: "Not Started", target_date: null }, today).state).toBe("ok");
  });
  it("stale detection", () => {
    expect(isStale({ status: "In Progress", updated_at: "2026-08-01T00:00:00Z" }, today)).toBe(true);
    expect(isStale({ status: "In Progress", updated_at: "2026-10-01T00:00:00Z" }, today)).toBe(false);
  });
});
describe("dates", () => {
  it("month maths", () => { expect(addMonths("2026-11-01", 2)).toBe("2027-01-01"); expect(addMonths("2026-01-01", -1)).toBe("2025-12-01"); expect(daysInMonth("2028-02-01")).toBe(29); expect(diffDays("2026-10-04", "2026-09-30")).toBe(4); });
});
describe("analytics buckets", () => {
  it("granularity and weekly buckets start on Monday", () => {
    expect(granularityFor("2026-09-05", "2026-10-04")).toBe("day"); expect(granularityFor("2026-07-07", "2026-10-04")).toBe("week"); expect(granularityFor("2025-10-05", "2026-10-04")).toBe("month");
    expect(bucketStart("2026-10-04", "week")).toBe("2026-09-28");
  });
  it("sums rows into buckets and ignores out-of-range", () => {
    const b = bucketList("2026-10-01", "2026-10-03", "day");
    expect(sumBy([{ date: "2026-10-01", amount: 5 }, { date: "2026-10-01", amount: 2 }, { date: "2026-10-09", amount: 9 }], b, "day")).toEqual([7, 0, 0]);
  });
  it("presets and folding", () => {
    expect(rangeFor("7d", today)).toEqual({ from: "2026-09-28", to: today });
    expect(foldTop(Array.from({ length: 10 }, (_, i) => ({ name: `c${i}`, value: 10 - i })), 3)).toHaveLength(4);
  });
});
describe("compact money", () => {
  it("uses Indian units for INR and K/M otherwise", () => {
    expect([80000, 150000, 25000000, 950].map((n) => compact(n, "INR"))).toEqual(["80k", "1.5L", "2.5Cr", "950"]);
    expect(compact(80000, "USD")).toBe("80K");
  });
});
describe("finance helpers", () => {
  it("pctChange and projection", () => { expect(pctChange(120, 100)).toBe(20); expect(pctChange(5, 0)).toBeNull(); expect(projectedSpend(1000, 10, 30)).toBe(3000); });
});
describe("partial updates never reset untouched columns", () => {
  it("zod partial injects defaults (the bug), onlyProvided removes them", () => {
    const parsed = goalSchema.partial().parse({ current_value: 3 });
    expect(onlyProvided(parsed, { current_value: 3 })).toEqual({ current_value: 3 });
    const t = taskSchema.partial().parse({ due_date: "2026-10-04" });
    expect(onlyProvided(t, { due_date: "2026-10-04" })).toEqual({ due_date: "2026-10-04" });
  });
});
