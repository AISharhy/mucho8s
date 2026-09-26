create table if not exists public.live_team_matches (
  id uuid primary key default gen_random_uuid(),
  match_id text not null unique,
  team_a jsonb not null default '[]'::jsonb,
  team_b jsonb not null default '[]'::jsonb,
  game text not null default '',
  mode text not null default '',
  format text not null default '',
  captain_player_id text,
  creator_account_id uuid references auth.users(id) on delete set null,
  status text not null default 'live' check (status in ('live','closed','cancelled')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists live_team_matches_status_created_idx
  on public.live_team_matches (status, created_at desc);

create index if not exists live_team_matches_creator_idx
  on public.live_team_matches (creator_account_id, created_at desc);

alter table public.live_team_matches enable row level security;
revoke all on table public.live_team_matches from anon, authenticated;
