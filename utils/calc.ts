const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const savings = (income: number, expenses: number) => income - expenses;
export const savingsRate = (income: number, expenses: number) => (income > 0 ? ((income - expenses) / income) * 100 : 0);
export const budgetRemaining = (budget: number, spent: number) => budget - spent;
export const budgetUsage = (budget: number, spent: number) => (budget > 0 ? (spent / budget) * 100 : 0);
export const budgetStatus = (usage: number) => (usage >= 100 ? "over" : usage >= 90 ? "critical" : usage >= 80 ? "warning" : "ok");
export const goalProgress = (current: number, target: number) => (target > 0 ? clamp((current / target) * 100, 0, 100) : 0);
export const debtRemaining = (original: number, payments: number[]) => Math.max(0, original - payments.reduce((a, b) => a + b, 0));
export const completionPct = (completed: number, total: number) => (total > 0 ? (completed / total) * 100 : 0);
