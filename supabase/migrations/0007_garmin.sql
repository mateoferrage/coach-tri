-- Garmin credentials (encrypted)
create table if not exists public.garmin_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles on delete cascade,
  email_enc       text not null,
  password_enc    text not null,
  session_data    jsonb,
  last_sync_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger garmin_credentials_updated_at
  before update on public.garmin_credentials for each row execute function update_updated_at();

-- RLS: user can read/write their own credentials row
alter table public.garmin_credentials enable row level security;

create policy "select_own" on public.garmin_credentials for select using (auth.uid() = user_id);
create policy "insert_own" on public.garmin_credentials for insert with check (auth.uid() = user_id);
create policy "update_own" on public.garmin_credentials for update using (auth.uid() = user_id);
create policy "delete_own" on public.garmin_credentials for delete using (auth.uid() = user_id);

-- Garmin activities
create table if not exists public.garmin_activities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles on delete cascade,
  garmin_activity_id  bigint not null,
  activity_type       text not null,
  started_at          timestamptz not null,
  duration_s          int,
  distance_m          numeric,
  avg_hr              int,
  max_hr              int,
  avg_speed_ms        numeric,
  elevation_gain_m    numeric,
  training_effect     numeric,
  aerobic_te          numeric,
  anaerobic_te        numeric,
  raw_data            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, garmin_activity_id)
);

create index if not exists garmin_activities_user_date on public.garmin_activities (user_id, started_at desc);

create trigger garmin_activities_updated_at
  before update on public.garmin_activities for each row execute function update_updated_at();

alter table public.garmin_activities enable row level security;

create policy "select_own" on public.garmin_activities for select using (auth.uid() = user_id);
create policy "insert_own" on public.garmin_activities for insert with check (auth.uid() = user_id);
create policy "update_own" on public.garmin_activities for update using (auth.uid() = user_id);
create policy "delete_own" on public.garmin_activities for delete using (auth.uid() = user_id);

-- Garmin wellness (daily)
create table if not exists public.garmin_wellness (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles on delete cascade,
  date                date not null,
  sleep_duration_s    int,
  sleep_score         int,
  hrv_rmssd           numeric,
  body_battery_start  int,
  body_battery_end    int,
  stress_avg          int,
  resting_hr          int,
  steps               int,
  total_calories      int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists garmin_wellness_user_date on public.garmin_wellness (user_id, date desc);

create trigger garmin_wellness_updated_at
  before update on public.garmin_wellness for each row execute function update_updated_at();

alter table public.garmin_wellness enable row level security;

create policy "select_own" on public.garmin_wellness for select using (auth.uid() = user_id);
create policy "insert_own" on public.garmin_wellness for insert with check (auth.uid() = user_id);
create policy "update_own" on public.garmin_wellness for update using (auth.uid() = user_id);
create policy "delete_own" on public.garmin_wellness for delete using (auth.uid() = user_id);
