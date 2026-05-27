create table if not exists public.chat_messages (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users on delete cascade,
  role            text        not null check (role in ('user', 'assistant')),
  content         text        not null,
  proposed_action jsonb,
  action_status   text        check (action_status in ('pending', 'confirmed', 'rejected')),
  created_at      timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "own_messages" on public.chat_messages
  for all using (auth.uid() = user_id);

create index chat_messages_user_created on public.chat_messages (user_id, created_at desc);
