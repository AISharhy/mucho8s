alter table public.season_archives
  add column if not exists awards jsonb not null default '[]'::jsonb;
