create table if not exists public.goals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles on delete cascade,
  race_name             text not null,
  race_date             date not null,
  race_type             text not null check (race_type in ('sprint', 'olympic', 'half', 'full', 'xterra', 'custom')),
  swim_distance_m       int,
  bike_distance_m       int,
  run_distance_m        int,
  bike_elevation_m      int,
  run_elevation_m       int,
  terrain               text check (terrain in ('flat', 'hilly', 'mountainous')),
  priority              text not null default 'A' check (priority in ('A', 'B', 'C')),
  target_type           text not null default 'finish' check (target_type in ('finish', 'time', 'podium')),
  target_time_seconds   int,
  status                text not null default 'draft' check (status in ('draft', 'active', 'completed', 'abandoned')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists goals_user_race_date on public.goals (user_id, race_date);

create trigger goals_updated_at
  before update on public.goals
  for each row execute function update_updated_at();

alter table public.goals enable row level security;

create policy "select_own" on public.goals for select using (auth.uid() = user_id);
create policy "insert_own" on public.goals for insert with check (auth.uid() = user_id);
create policy "update_own" on public.goals for update using (auth.uid() = user_id);
create policy "delete_own" on public.goals for delete using (auth.uid() = user_id);
