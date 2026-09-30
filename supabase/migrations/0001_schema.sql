create extension if not exists "pgcrypto";

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text, email text, avatar_url text,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  week_start smallint not null default 1 check (week_start between 0 and 6),
  default_task_duration int not null default 30 check (default_task_duration > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0), description text,
  goal_horizon text not null check (goal_horizon in ('Daily','Short-Term','Medium-Term','Long-Term','5-Year','10-Year')),
  category text not null default 'Other',
  start_date date, target_date date,
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  status text not null default 'Not Started' check (status in ('Not Started','In Progress','Completed','Paused','Cancelled')),
  progress_percentage numeric not null default 0 check (progress_percentage between 0 and 100),
  parent_goal_id uuid references goals(id) on delete set null,
  target_value numeric check (target_value is null or target_value > 0),
  current_value numeric check (current_value is null or current_value >= 0),
  unit text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (parent_goal_id is distinct from id)
);

-- Target-value goals: derive and clamp progress automatically.
create or replace function goal_calc_progress() returns trigger language plpgsql as $$
begin
  if new.target_value is not null and new.current_value is not null then
    new.progress_percentage = least(100, greatest(0, round(new.current_value / new.target_value * 100, 2)));
  end if;
  return new;
end $$;
create trigger goals_progress before insert or update on goals for each row execute function goal_calc_progress();

create table goal_milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text, target_date date,
  status text not null default 'Not Started' check (status in ('Not Started','In Progress','Completed','Cancelled')),
  progress_percentage numeric not null default 0 check (progress_percentage between 0 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz
);

create table task_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, color text, created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0), description text,
  status text not null default 'Todo' check (status in ('Todo','In Progress','Completed','Cancelled')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  category text, due_date date, due_time time,
  estimated_minutes int check (estimated_minutes is null or estimated_minutes > 0),
  actual_minutes int check (actual_minutes is null or actual_minutes >= 0),
  goal_id uuid references goals(id) on delete set null,
  milestone_id uuid references goal_milestones(id) on delete set null,
  recurring boolean not null default false, recurrence_rule text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz
);

create table task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  completed_on date not null, created_at timestamptz not null default now(),
  unique (task_id, completed_on)
);

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text,
  frequency text not null default 'Daily' check (frequency in ('Daily','Weekly','Custom')),
  target int not null default 1 check (target > 0),
  start_date date not null default current_date, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  completed_on date not null, created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

create table income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null, amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date, category text,
  recurring boolean not null default false, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, amount numeric(14,2) not null check (amount > 0),
  category text not null default 'Other', date date not null default current_date,
  payment_method text, recurring boolean not null default false, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, amount numeric(14,2) not null check (amount > 0),
  month date not null check (extract(day from month) = 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, category, month)
);

create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creditor text not null, description text,
  original_amount numeric(14,2) not null check (original_amount > 0),
  remaining_amount numeric(14,2) not null check (remaining_amount >= 0),
  interest_rate numeric(6,3) not null default 0 check (interest_rate >= 0),
  minimum_payment numeric(14,2) check (minimum_payment is null or minimum_payment >= 0),
  due_date date, start_date date,
  status text not null default 'Active' check (status in ('Active','Paid','Paused','Cancelled')),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references debts(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date, notes text,
  created_at timestamptz not null default now()
);

-- Recording a payment lowers remaining_amount, never below zero; marks Paid at zero.
create or replace function apply_debt_payment() returns trigger language plpgsql as $$
begin
  update debts set remaining_amount = greatest(0, remaining_amount - new.amount),
    status = case when remaining_amount - new.amount <= 0 then 'Paid' else status end
  where id = new.debt_id and user_id = new.user_id;
  return new;
end $$;
create trigger debt_payment_applied after insert on debt_payments for each row execute function apply_debt_payment();

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null, category text,
  estimated_price numeric(14,2) check (estimated_price is null or estimated_price >= 0),
  actual_price numeric(14,2) check (actual_price is null or actual_price >= 0),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  planned_date date,
  status text not null default 'Considering' check (status in ('Considering','Planned','Ordered','Purchased','Cancelled')),
  purchase_url text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text, event_type text not null default 'custom',
  start_time timestamptz not null, end_time timestamptz, all_day boolean not null default false,
  related_task_id uuid references tasks(id) on delete cascade,
  related_goal_id uuid references goals(id) on delete cascade,
  related_debt_id uuid references debts(id) on delete cascade,
  related_shopping_item_id uuid references shopping_items(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_time is null or end_time >= start_time)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, content text not null default '', category text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, message text,
  type text not null check (type in ('Task Due','Task Overdue','Goal Deadline','Milestone Deadline','Debt Payment','Habit Reminder','Purchase Reminder')),
  read boolean not null default false, scheduled_for timestamptz,
  created_at timestamptz not null default now()
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, entity_type text, entity_id uuid, description text,
  created_at timestamptz not null default now()
);

-- Indexes (composite where the query pattern is user-scoped).
create index on tasks (user_id, status, due_date);
create index on tasks (goal_id); create index on tasks (milestone_id);
create index on goals (user_id, goal_horizon, status); create index on goals (parent_goal_id);
create index on goal_milestones (goal_id, target_date);
create index on habit_completions (habit_id, completed_on);
create index on income (user_id, date); create index on expenses (user_id, date, category);
create index on debt_payments (debt_id, payment_date);
create index on shopping_items (user_id, status, planned_date);
create index on calendar_events (user_id, start_time);
create index on notifications (user_id, read, created_at desc);
create index on activity_logs (user_id, created_at desc);
create index on notes using gin (tags);

-- updated_at triggers, RLS enable, and owner-only policies on every user-owned table.
do $$
declare t text;
begin
  foreach t in array array['profiles','tasks','task_categories','task_completions','goals','goal_milestones','habits',
    'habit_completions','income','expenses','budgets','debts','debt_payments','shopping_items','calendar_events',
    'notes','notifications','activity_logs'] loop
    if t not in ('task_categories','task_completions','habit_completions','debt_payments','notifications','activity_logs') then
      execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
    end if;
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%s_select" on %I for select using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_insert" on %I for insert with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_update" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_delete" on %I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- Create a profile row on signup.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, email, full_name) values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
