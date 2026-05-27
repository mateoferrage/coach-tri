-- Precise start time for manually scheduled sessions (set on drag-and-drop)
alter table sessions add column if not exists session_time time null;
