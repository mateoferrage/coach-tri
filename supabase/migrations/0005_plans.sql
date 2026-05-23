create table if not exists public.plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles on delete cascade,
  goal_id         uuid not null references public.goals on delete cascade,
  name            text,
  start_date      date not null,
  end_date        date not null,
  methodology     text not null check (methodology in ('polarized', 'pyramidal', 'threshold', 'custom')),
  periodization   text not null check (periodization in ('linear', 'block', 'reverse')),
  status          text not null default 'active' check (status in ('active', 'archived')),
  params          jsonb,
  summary         jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.plan_phases (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.plans on delete cascade,
  phase           text not null check (phase in ('prep', 'base', 'build', 'peak', 'taper', 'race')),
  start_week_num  int not null,
  end_week_num    int not null,
  focus           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.plan_weeks (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references public.plans on delete cascade,
  week_num              int not null,
  start_date            date not null,
  phase                 text not null,
  is_recovery_week      bool not null default false,
  planned_volume_hours  numeric,
  planned_tss           int,
  distribution          jsonb,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists plan_weeks_plan_num on public.plan_weeks (plan_id, week_num);

create table if not exists public.plan_generations (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.plans on delete cascade,
  trigger         text not null check (trigger in ('initial', 'week_regenerate', 'full_regenerate', 'adjustment')),
  scope           jsonb,
  prompt_snapshot text,
  model           text,
  response_meta   jsonb,
  created_at      timestamptz not null default now()
);

create trigger plans_updated_at
  before update on public.plans for each row execute function update_updated_at();
create trigger plan_phases_updated_at
  before update on public.plan_phases for each row execute function update_updated_at();
create trigger plan_weeks_updated_at
  before update on public.plan_weeks for each row execute function update_updated_at();

alter table public.plans enable row level security;
alter table public.plan_phases enable row level security;
alter table public.plan_weeks enable row level security;
alter table public.plan_generations enable row level security;

create policy "select_own" on public.plans for select using (auth.uid() = user_id);
create policy "insert_own" on public.plans for insert with check (auth.uid() = user_id);
create policy "update_own" on public.plans for update using (auth.uid() = user_id);
create policy "delete_own" on public.plans for delete using (auth.uid() = user_id);

-- plan_phases/plan_weeks: access via plan ownership
create policy "select_own" on public.plan_phases for select
  using (exists (select 1 from public.plans where plans.id = plan_phases.plan_id and plans.user_id = auth.uid()));
create policy "insert_own" on public.plan_phases for insert
  with check (exists (select 1 from public.plans where plans.id = plan_phases.plan_id and plans.user_id = auth.uid()));
create policy "update_own" on public.plan_phases for update
  using (exists (select 1 from public.plans where plans.id = plan_phases.plan_id and plans.user_id = auth.uid()));
create policy "delete_own" on public.plan_phases for delete
  using (exists (select 1 from public.plans where plans.id = plan_phases.plan_id and plans.user_id = auth.uid()));

create policy "select_own" on public.plan_weeks for select
  using (exists (select 1 from public.plans where plans.id = plan_weeks.plan_id and plans.user_id = auth.uid()));
create policy "insert_own" on public.plan_weeks for insert
  with check (exists (select 1 from public.plans where plans.id = plan_weeks.plan_id and plans.user_id = auth.uid()));
create policy "update_own" on public.plan_weeks for update
  using (exists (select 1 from public.plans where plans.id = plan_weeks.plan_id and plans.user_id = auth.uid()));
create policy "delete_own" on public.plan_weeks for delete
  using (exists (select 1 from public.plans where plans.id = plan_weeks.plan_id and plans.user_id = auth.uid()));

create policy "select_own" on public.plan_generations for select
  using (exists (select 1 from public.plans where plans.id = plan_generations.plan_id and plans.user_id = auth.uid()));
create policy "insert_own" on public.plan_generations for insert
  with check (exists (select 1 from public.plans where plans.id = plan_generations.plan_id and plans.user_id = auth.uid()));
