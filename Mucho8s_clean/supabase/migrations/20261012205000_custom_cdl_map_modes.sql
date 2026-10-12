-- Persist each HP / S&D slot of a custom CDL series.
ALTER TABLE public.live_team_matches
  ADD COLUMN IF NOT EXISTS map_modes jsonb NOT NULL DEFAULT '[]'::jsonb;
