import { describe, expect, it } from "vitest";
import { MAX_RESCHEDULES, isOverdueTask, rescheduleErrorMessage, rescheduleInfo } from "../utils/tasks";

const today = "2026-10-05";
describe("overdue tasks", () => {
  it("is overdue only when open and past due", () => {
    expect(isOverdueTask({ due_date: "2026-10-04", status: "Todo" }, today)).toBe(true);
    expect(isOverdueTask({ due_date: "2026-10-05", status: "Todo" }, today)).toBe(false);
    expect(isOverdueTask({ due_date: "2026-10-01", status: "Completed" }, today)).toBe(false);
    expect(isOverdueTask({ due_date: null, status: "Todo" }, today)).toBe(false);
  });
  it("tracks the 3-edit allowance", () => {
    expect(MAX_RESCHEDULES).toBe(3);
    expect(rescheduleInfo({ due_date: "2026-10-01", status: "Todo" }, today)).toMatchObject({ used: 0, remaining: 3, locked: false, isLast: false, nextAttempt: 1, overdueDays: 4 });
    expect(rescheduleInfo({ due_date: "2026-10-01", status: "Todo", reschedule_count: 2 }, today)).toMatchObject({ used: 2, remaining: 1, isLast: true, nextAttempt: 3 });
    expect(rescheduleInfo({ due_date: "2026-10-01", status: "Todo", reschedule_count: 3 }, today)).toMatchObject({ remaining: 0, locked: true });
    expect(rescheduleInfo({ due_date: "2026-10-01", status: "Todo", reschedule_count: 9 }, today).used).toBe(3);
  });
  it("maps database errors to readable messages", () => {
    expect(rescheduleErrorMessage({ message: "RESCHEDULE_LIMIT: this task has already had 3 date edits" })).toMatch(/used all 3 date edits/);
    expect(rescheduleErrorMessage({ message: "RESCHEDULE_PAST_DATE: x" })).toMatch(/today or a later date/);
    expect(rescheduleErrorMessage({ code: "PGRST202", message: "Could not find the function" })).toMatch(/0002/);
    expect(rescheduleErrorMessage({ message: 'duplicate key value violates "tasks_pkey"' })).not.toMatch(/tasks_pkey/);
  });
});
