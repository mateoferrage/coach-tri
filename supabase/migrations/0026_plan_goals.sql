-- Un plan peut désormais cibler plusieurs courses (course A principale + B/C secondaires).
-- plans.goal_id est conservé et pointe sur la course principale (rétro-compat).
create table if not exists public.plan_goals (
  plan_id uuid not null references public.plans(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, goal_id)
);

alter table public.plan_goals enable row level security;

-- RLS : l'utilisateur accède aux liens de ses propres plans.
drop policy if exists "plan_goals owner access" on public.plan_goals;
create policy "plan_goals owner access" on public.plan_goals
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));

-- Backfill : rattacher les plans existants à leur goal_id courant.
insert into public.plan_goals (plan_id, goal_id)
select id, goal_id from public.plans where goal_id is not null
on conflict do nothing;
