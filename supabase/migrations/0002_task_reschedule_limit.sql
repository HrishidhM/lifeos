-- Overdue tasks may have their due date changed at most 3 times. The limit lives in the database so
-- no client (browser tab, API call) can bypass it. Counters are written only by the trigger below.

alter table tasks
  add column if not exists reschedule_count smallint not null default 0 check (reschedule_count between 0 and 3),
  add column if not exists last_rescheduled_at timestamptz,
  add column if not exists original_due_date date,
  add column if not exists last_reschedule_reason text;

create or replace function enforce_task_reschedule_limit() returns trigger language plpgsql as $$
declare
  max_edits constant int := 3;
  tz text;
  local_today date;
  reason text;
begin
  if tg_op = 'INSERT' then
    new.reschedule_count := 0; new.last_rescheduled_at := null; new.original_due_date := null; new.last_reschedule_reason := null;
    return new;
  end if;

  -- Clients cannot set the counters; keep the stored values unless this update is a counted reschedule.
  -- The reason can only arrive through reschedule_task() below, as a one-transaction setting.
  reason := current_setting('app.reschedule_reason', true);
  new.reschedule_count := old.reschedule_count;
  new.last_rescheduled_at := old.last_rescheduled_at;
  new.original_due_date := old.original_due_date;
  new.last_reschedule_reason := old.last_reschedule_reason;

  if new.due_date is not distinct from old.due_date then return new; end if;

  -- "Today" is the user's own day (profile timezone), matching what the app shows.
  select coalesce((select timezone from profiles where user_id = new.user_id), 'UTC') into tz;
  begin
    local_today := (now() at time zone tz)::date;
  exception when others then
    local_today := (now() at time zone 'UTC')::date;
  end;

  -- Only changing the deadline of a task that is overdue right now is limited and recorded.
  if old.due_date is null or old.due_date >= local_today or old.status not in ('Todo', 'In Progress') then
    return new;
  end if;
  if new.due_date is null or new.due_date < local_today then
    raise exception 'RESCHEDULE_PAST_DATE: an overdue task needs a new date of today or later';
  end if;
  if old.reschedule_count >= max_edits then
    raise exception 'RESCHEDULE_LIMIT: this task has already had % date edits', max_edits;
  end if;

  new.reschedule_count := old.reschedule_count + 1;
  new.last_rescheduled_at := now();
  new.original_due_date := coalesce(old.original_due_date, old.due_date);
  new.last_reschedule_reason := nullif(trim(coalesce(reason, '')), '');
  return new;
end $$;

drop trigger if exists tasks_reschedule_limit on tasks;
create trigger tasks_reschedule_limit before insert or update on tasks
  for each row execute function enforce_task_reschedule_limit();

-- The app calls this so a reason can accompany the edit. Runs as the caller, so row level security still applies.
create or replace function reschedule_task(p_task_id uuid, p_new_date date, p_reason text default null) returns tasks
language plpgsql security invoker as $$
declare t tasks;
begin
  perform set_config('app.reschedule_reason', coalesce(p_reason, ''), true);
  update tasks set due_date = p_new_date where id = p_task_id returning * into t;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  return t;
end $$;
