create table if not exists schedule_events (
  id                   uuid default gen_random_uuid() primary key,
  user_id              uuid references auth.users(id) on delete cascade not null,
  title                text not null,
  event_type           text check (event_type in ('cours', 'stage', 'rdv', 'autre')) not null default 'autre',
  event_date           date not null,
  start_time           time not null,
  end_time             time not null,
  is_recurring         boolean not null default false,
  recurrence_day       int check (recurrence_day between 1 and 7) null, -- ISO weekday: 1=Mon … 7=Sun
  recurrence_end_date  date null,
  created_at           timestamptz default now() not null,
  updated_at           timestamptz default now() not null
);

create index if not exists idx_schedule_events_user_date
  on schedule_events (user_id, event_date);

alter table schedule_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'schedule_events' and policyname = 'select_own_schedule') then
    create policy "select_own_schedule" on schedule_events for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'schedule_events' and policyname = 'insert_own_schedule') then
    create policy "insert_own_schedule" on schedule_events for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'schedule_events' and policyname = 'update_own_schedule') then
    create policy "update_own_schedule" on schedule_events for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'schedule_events' and policyname = 'delete_own_schedule') then
    create policy "delete_own_schedule" on schedule_events for delete using (auth.uid() = user_id);
  end if;
end $$;
