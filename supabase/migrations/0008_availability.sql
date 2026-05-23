create table if not exists public.availability_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint start_before_end check (start_date <= end_date)
);

create trigger availability_blocks_updated_at
  before update on public.availability_blocks for each row execute function update_updated_at();

alter table public.availability_blocks enable row level security;

create policy "select_own" on public.availability_blocks for select using (auth.uid() = user_id);
create policy "insert_own" on public.availability_blocks for insert with check (auth.uid() = user_id);
create policy "update_own" on public.availability_blocks for update using (auth.uid() = user_id);
create policy "delete_own" on public.availability_blocks for delete using (auth.uid() = user_id);
