-- Add equipment JSONB column to profiles: stores triathlete gear (swim accessories, bike aero bars, run shoes)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '{}';
