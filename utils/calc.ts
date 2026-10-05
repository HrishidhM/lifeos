const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const savings = (income: number, expenses: number) => income - expenses;
export const savingsRate = (income: number, expenses: number) => (income > 0 ? ((income - expenses) / income) * 100 : 0);
export const budgetRemaining = (budget: number, spent: number) => budget - spent;
export const budgetUsage = (budget: number, spent: number) => (budget > 0 ? (spent / budget) * 100 : 0);
export const budgetStatus = (usage: number) => (usage >= 100 ? "over" : usage >= 90 ? "critical" : usage >= 80 ? "warning" : "ok");
export const goalProgress = (current: number, target: number) => (target > 0 ? clamp((current / target) * 100, 0, 100) : 0);
export const debtRemaining = (original: number, payments: number[]) => Math.max(0, original - payments.reduce((a, b) => a + b, 0));
export const completionPct = (completed: number, total: number) => (total > 0 ? (completed / total) * 100 : 0);

/** Percent change from prev to cur; null when there is no baseline. */
export const pctChange = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
/** Straight-line projection of month-end spending from spend so far. */
export const projectedSpend = (spent: number, dayOfMonth: number, daysInMonth: number) => (dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : 0);
