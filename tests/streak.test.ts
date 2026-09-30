import { describe, expect, it } from "vitest";
import { completionRate, currentStreak, longestStreak } from "../utils/streak";

describe("streaks", () => {
  const d = ["2026-09-26", "2026-09-27", "2026-09-29", "2026-09-30"];
  it("current streak counts back from today", () => { expect(currentStreak(d, "2026-09-30")).toBe(2); expect(currentStreak(d, "2026-10-01")).toBe(2); expect(currentStreak(d, "2026-10-03")).toBe(0); });
  it("longest streak", () => { expect(longestStreak(d)).toBe(2); expect(longestStreak([])).toBe(0); });
  it("completion rate", () => { expect(completionRate(d, "2026-09-30", 10)).toBe(40); });
});
