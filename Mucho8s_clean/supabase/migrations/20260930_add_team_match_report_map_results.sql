alter table public.team_match_reports
  add column if not exists map_results jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
