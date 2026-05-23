create table if not exists public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  first_name      text,
  birth_date      date,
  sex             text check (sex in ('M', 'F', 'X')),
  weight_kg       numeric,
  height_cm       numeric,
  experience_years int,
  level           text check (level in ('beginner', 'intermediate', 'advanced', 'elite')),
  weekly_hours_avg numeric,
  available_disciplines text[],
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at();

alter table public.profiles enable row level security;

create policy "select_own_profile" on public.profiles
  for select using (auth.uid() = id);

create policy "insert_own_profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "update_own_profile" on public.profiles
  for update using (auth.uid() = id);
