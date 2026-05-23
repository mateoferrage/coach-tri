-- Extensions and utility functions
create extension if not exists "pgcrypto";

-- Utility: auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
