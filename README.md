# LifeOS

A personal life-management app: tasks, goals (10-year down to daily), habits, finance, debt, shopping, notes, calendar and analytics.
Next.js (App Router) + Supabase (Postgres, Auth, Row Level Security) + Recharts. No AI dependency.

## What is in it
- **Dashboard**: today's tasks (tick them off in place), one "Needs attention" panel for overdue tasks, goals and milestones, goals with horizon tabs and overdue badges, upcoming milestones, finance charts and budget warnings, habits, debt, shopping, events and recent activity.
- **Goals**: hierarchy and timeline views; filters (overdue, due soon, in progress, completed); overdue goals and milestones are highlighted with a label as well as colour; detail page with progress, milestones, child goals and linked tasks.
- **Analytics**: range presets (7 days to 1 year) plus a custom range; Productivity, Goals, Finance and Habits sections; every chart has a table view; click-through drill-down on categories and goal stages.
- **Finance**: month navigation, comparison with last month, projected month-end spend (after day 7), income vs expenses and savings trends, category drill-down, edit/delete transactions with search, filters and CSV export, budgets with copy-forward and 80/90/100% warnings.
- Today, Tasks, Habits, Debt (payments reduce the balance, never below 0), Shopping, Notes, Calendar agenda, Settings (profile, currency, timezone, JSON/CSV export), Quick Add, Ctrl+K search, light/dark theme, rotating motivational quotes.
- "Today" everywhere uses the timezone saved in Settings.

## Setup
1. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_schema.sql`, then `supabase/migrations/0002_task_reschedule_limit.sql` (required for the overdue-task edit limit).
2. `cp .env.example .env.local` and set `NEXT_PUBLIC_SUPABASE_URL` (`https://YOUR-REF.supabase.co`, nothing after `.co`) and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put the service-role key in the app.
3. `npm install`, then `npm run dev` and open http://localhost:3000.
4. Optional demo data (development only): register an account, put its email at the top of `supabase/seed.sql`, run it in the SQL editor.

## Overdue task edits
The Tasks page has an **Overdue tasks** section. Changing an overdue task's due date is limited to **3 edits per task**, enforced by a database trigger (not just the UI). It shows "N of 3 date edits used", the last-edited time, the original due date and an optional reason. At 3 edits the date is locked: the task can only be completed or cancelled. Test it with `npm run test:db`.

## Scripts
`npm run dev` · `npm run build` · `npm run start` · `npm run lint` · `npm run typecheck` · `npm run test`

## Deploy (Vercel)
Push to GitHub, import the repo in Vercel (framework: Next.js; root directory is the folder containing `package.json`), add the two environment variables, deploy. Then in Supabase, Authentication, URL Configuration: set Site URL to your Vercel URL and add `https://YOUR-APP.vercel.app/**` to Redirect URLs.

## Structure
`app/` routes · `features/` dashboard, finance and analytics views · `components/` shared UI and older module views · `components/ui` Card, Tabs, Modal, Badge · `components/charts.tsx` Recharts wrappers · `lib/services/` all Supabase access · `utils/` pure logic (calculations, dates, goal health, analytics aggregation) · `supabase/` migration and seed · `tests/` unit tests · `proxy.ts` auth redirects.

## Security
Row Level Security is enabled on every table with owner-only policies (`auth.uid() = user_id`). Check with two accounts that neither can see the other's data. The unit tests do not cover RLS.

## Not built yet
Task detail pages and Kanban/calendar task views, task-to-milestone linking in the UI, notifications centre, calendar month/week/day views and event creation, editing goals beyond progress, avatar upload, account deletion, RLS integration tests.
