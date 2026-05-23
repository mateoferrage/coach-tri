create table if not exists public.physiology (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references public.profiles on delete cascade,
  test_date                       date not null default current_date,
  ftp_watts                       int,
  hr_max                          int,
  hr_threshold_bike               int,
  vma_kmh                         numeric,
  run_threshold_pace_sec_per_km   int,
  hr_max_run                      int,
  hr_threshold_run                int,
  css_pace_sec_per_100m           int,
  source                          text check (source in ('test', 'manual', 'estimated')),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists physiology_user_date on public.physiology (user_id, test_date desc);

create trigger physiology_updated_at
  before update on public.physiology
  for each row execute function update_updated_at();

-- View: most recent physiology per user
create or replace view public.physiology_current as
  select distinct on (user_id) *
  from public.physiology
  order by user_id, test_date desc;

alter table public.physiology enable row level security;

create policy "select_own" on public.physiology for select using (auth.uid() = user_id);
create policy "insert_own" on public.physiology for insert with check (auth.uid() = user_id);
create policy "update_own" on public.physiology for update using (auth.uid() = user_id);
create policy "delete_own" on public.physiology for delete using (auth.uid() = user_id);
