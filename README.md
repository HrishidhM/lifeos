# LifeOS (foundation)

Personal life-management app: Next.js + Supabase (Postgres, Auth, RLS).

## Included so far
- `supabase/migrations/0001_schema.sql`: all 18 core tables, constraints, indexes, `updated_at` triggers,
  RLS (owner-only select/insert/update/delete on every table), signup profile trigger,
  automatic goal-progress calculation, and debt-payment balancing (clamped at 0).
- Supabase browser/server clients and auth-protecting `middleware.ts`.
- `lib/services/tasks.ts` + `activity.ts` (the pattern for the remaining services), `utils/calc.ts` with unit tests.

## Setup
1. Create a Supabase project, then run the migration in the SQL editor (or `supabase db push`).
2. `cp .env.example .env.local` and fill in the project URL and anon key. Never use the service-role key in the browser.
3. `npm install && npm run dev`, `npm run test`.

## Frontend
Deadline banner on every page (overdue + next 3 days), Quick Add, Ctrl+K search, theme toggle, task-to-goal linking, dev seed (supabase/seed.sql). Today, Calendar (30-day agenda), Analytics (30-day summary), Notes, Settings (profile, JSON/CSV export). Habits (daily check-in, current and longest streak, 30-day rate, 28-day grid). Shopping (planned cost, purchased total, priority, status, search and filter). Debt (totals, payoff progress, record payments with balance clamp, upcoming payments, history). Finance (monthly income, expenses, savings and rate, budgets with 80/90/100% warnings, category breakdown, transactions). Goals (hierarchy tree, 10-Year to Daily horizons, detail page with progress, milestones, child goals, linked tasks). Auth pages, sidebar shell (mobile bottom nav), dashboard (real task stats), and Tasks page (create, complete, reopen, delete, filter).

## Not yet built
Other modules (goals, habits, finance, debt, shopping, calendar, analytics, notes, settings), remaining services, charts, seed script, RLS integration tests.
