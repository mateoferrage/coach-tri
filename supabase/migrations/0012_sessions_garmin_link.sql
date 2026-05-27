-- Link a training session to a completed Garmin activity
alter table public.sessions
  add column if not exists garmin_activity_id uuid references public.garmin_activities(id) on delete set null;

create index if not exists sessions_garmin_activity on public.sessions (garmin_activity_id);
