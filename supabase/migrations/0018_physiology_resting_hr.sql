-- Add resting heart rate to physiology for Karvonen zone calculation
alter table public.physiology
  add column if not exists resting_hr int check (resting_hr between 25 and 100);
