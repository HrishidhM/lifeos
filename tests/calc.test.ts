import { describe, expect, it } from "vitest";
import * as c from "../utils/calc";

describe("calculations", () => {
  it("savings and rate", () => { expect(c.savings(50000, 32000)).toBe(18000); expect(c.savingsRate(50000, 32000)).toBe(36); expect(c.savingsRate(0, 10)).toBe(0); });
  it("budget", () => { expect(c.budgetRemaining(10000, 7200)).toBe(2800); expect(c.budgetUsage(10000, 7200)).toBe(72); expect(c.budgetStatus(80)).toBe("warning"); expect(c.budgetStatus(100)).toBe("over"); });
  it("goal progress clamps", () => { expect(c.goalProgress(30, 50)).toBe(60); expect(c.goalProgress(80, 50)).toBe(100); expect(c.goalProgress(-5, 50)).toBe(0); });
  it("debt never negative", () => { expect(c.debtRemaining(1000, [400, 700])).toBe(0); expect(c.debtRemaining(1000, [250])).toBe(750); });
  it("completion %", () => { expect(c.completionPct(7, 10)).toBe(70); expect(c.completionPct(0, 0)).toBe(0); });
});

describe("budget edge cases", () => {
  it("handles zero budget and overspend", () => { expect(c.budgetUsage(0, 50)).toBe(0); expect(c.budgetRemaining(100, 130)).toBe(-30); expect(c.budgetStatus(c.budgetUsage(100, 130))).toBe("over"); });
});
