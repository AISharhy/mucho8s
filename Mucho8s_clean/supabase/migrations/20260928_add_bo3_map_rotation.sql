alter table public.live_team_matches
  add column if not exists maps jsonb not null default '[]'::jsonb;

alter table public.team_match_reports
  add column if not exists maps jsonb not null default '[]'::jsonb;
