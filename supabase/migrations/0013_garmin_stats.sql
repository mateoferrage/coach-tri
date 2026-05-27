-- Garmin fitness stats & profile (one row per user, upserted on each sync)
create table if not exists public.garmin_stats (
  user_id             uuid primary key references public.profiles on delete cascade,
  -- Garmin profile
  display_name        text,
  garmin_username     text,
  profile_image_url   text,
  -- Fitness metrics
  vo2max_run          numeric,
  vo2max_bike         numeric,
  fitness_age         int,
  training_readiness  int,
  training_load_7d    numeric,
  training_load_28d   numeric,
  -- Personal records (raw array from Garmin)
  personal_records    jsonb,
  -- Raw snapshots for debugging / future use
  raw_profile         jsonb,
  raw_fitness         jsonb,
  updated_at          timestamptz not null default now()
);

alter table public.garmin_stats enable row level security;
create policy "select_own" on public.garmin_stats for select using (auth.uid() = user_id);
create policy "insert_own" on public.garmin_stats for insert with check (auth.uid() = user_id);
create policy "update_own" on public.garmin_stats for update using (auth.uid() = user_id);
create policy "delete_own" on public.garmin_stats for delete using (auth.uid() = user_id);
