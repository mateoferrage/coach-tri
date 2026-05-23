create table if not exists public.sessions (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references public.plans on delete cascade,
  plan_week_id        uuid not null references public.plan_weeks on delete cascade,
  user_id             uuid not null references public.profiles on delete cascade,
  session_date        date not null,
  day_part            text check (day_part in ('morning', 'midday', 'evening')),
  discipline          text not null check (discipline in ('swim', 'bike', 'run', 'brick', 'strength', 'rest')),
  session_type        text not null check (session_type in ('easy', 'tempo', 'threshold', 'vo2', 'race_pace', 'technique', 'long', 'recovery', 'test')),
  template_code       text,
  duration_min        int not null,
  planned_tss         int,
  structure           jsonb,
  target_values       jsonb,
  target_zone         text,
  expected_rpe        int check (expected_rpe between 1 and 10),
  coaching_note       text,
  status              text not null default 'planned' check (status in ('planned', 'done', 'skipped', 'modified')),
  actual_duration_min int,
  actual_rpe          int check (actual_rpe between 1 and 10),
  actual_notes        text,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists sessions_user_date on public.sessions (user_id, session_date);
create index if not exists sessions_plan_date on public.sessions (plan_id, session_date);

create trigger sessions_updated_at
  before update on public.sessions for each row execute function update_updated_at();

alter table public.sessions enable row level security;

create policy "select_own" on public.sessions for select using (auth.uid() = user_id);
create policy "insert_own" on public.sessions for insert with check (auth.uid() = user_id);
create policy "update_own" on public.sessions for update using (auth.uid() = user_id);
create policy "delete_own" on public.sessions for delete using (auth.uid() = user_id);
