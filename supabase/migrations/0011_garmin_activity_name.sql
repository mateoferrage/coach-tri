-- Store the human-readable activity name from Garmin
alter table public.garmin_activities add column if not exists name text;
