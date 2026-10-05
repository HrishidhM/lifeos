-- DEVELOPMENT ONLY. Never run against production.
-- Replace the email with an account you have already registered, then run in the SQL editor.
do $$
declare uid uuid := (select id from auth.users where email = 'you@example.com'); g uuid; m uuid;
begin
  if uid is null then raise exception 'Register the account first, then set its email in seed.sql'; end if;
  insert into goals (user_id, title, goal_horizon, category, priority, status, target_date)
    values (uid, 'Build a successful AI company', '10-Year', 'Business', 'High', 'In Progress', current_date + 3650) returning id into g;
  insert into goals (user_id, title, goal_horizon, category, parent_goal_id, target_value, current_value, unit, target_date)
    values (uid, 'Master production RAG systems', 'Short-Term', 'Career', g, 50, 30, 'hours', current_date + 60) returning id into g;
  insert into goal_milestones (goal_id, user_id, title, target_date) values (g, uid, 'Build a RAG evaluation system', current_date + 2) returning id into m;
  insert into tasks (user_id, title, priority, due_date, goal_id, milestone_id) values
    (uid, 'Implement Recall@K', 'High', current_date, g, m), (uid, 'Create evaluation dataset', 'Medium', current_date + 1, g, m),
    (uid, 'Pay electricity bill', 'Critical', current_date - 1, null, null);
  insert into habits (user_id, name) values (uid, 'Read 20 minutes'), (uid, 'Workout');
  insert into income (user_id, source, amount, date) values (uid, 'Salary', 60000, date_trunc('month', current_date)::date);
  insert into expenses (user_id, title, amount, category, date) values (uid, 'Groceries', 3200, 'Food', current_date), (uid, 'Metro card', 800, 'Transport', current_date);
  insert into budgets (user_id, category, amount, month) values (uid, 'Food', 10000, date_trunc('month', current_date)::date);
  insert into debts (user_id, creditor, original_amount, remaining_amount, minimum_payment, due_date) values (uid, 'Education loan', 200000, 200000, 5000, current_date + 2);
  insert into shopping_items (user_id, item, estimated_price, priority, status, planned_date) values (uid, 'Mechanical keyboard', 6500, 'High', 'Planned', current_date + 14);
  insert into notes (user_id, title, content, tags) values (uid, 'RAG ideas', 'Compare chunk sizes and rerankers.', '{ai,rag}');
  -- Five earlier months of history so the trend charts have something to show.
  insert into income (user_id, source, amount, date, category)
    select uid, 'Salary', 60000, (date_trunc('month', current_date) - make_interval(months => n))::date, 'Salary' from generate_series(1, 5) n;
  insert into expenses (user_id, title, amount, category, date)
    select uid, c.t || ' (monthly)', c.a + n * 100, c.t, (date_trunc('month', current_date) - make_interval(months => n))::date + 2
    from generate_series(1, 5) n, (values ('Food', 9000), ('Rent', 18000), ('Transport', 2500)) as c(t, a);
end $$;
