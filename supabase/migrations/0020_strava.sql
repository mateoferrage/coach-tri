create table if not exists strava_credentials (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  athlete_id   bigint not null,
  access_token text not null,
  refresh_token text not null,
  expires_at   bigint not null,
  scope        text,
  last_sync_at timestamptz,
  created_at   timestamptz default now(),
  unique (user_id)
);

alter table strava_credentials enable row level security;

create policy "Users manage own strava credentials"
  on strava_credentials for all
  using (auth.uid() = user_id);

create table if not exists strava_activities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  strava_activity_id  bigint not null,
  activity_type       text not null,
  name                text,
  started_at          timestamptz not null,
  duration_s          integer,
  distance_m          numeric,
  avg_hr              integer,
  max_hr              integer,
  avg_speed_ms        numeric,
  elevation_gain_m    numeric,
  avg_watts           integer,
  suffer_score        integer,
  created_at          timestamptz default now(),
  unique (user_id, strava_activity_id)
);

alter table strava_activities enable row level security;

create policy "Users manage own strava activities"
  on strava_activities for all
  using (auth.uid() = user_id);
