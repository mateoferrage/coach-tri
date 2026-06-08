-- supabase/migrations/0021_equipment.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '{}';
