-- Competitive Teams / Clubs v1
create table if not exists public.competitive_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  description text not null default '',
  logo_url text,
  owner_account_id uuid not null references public.player_accounts(id) on delete cascade,
  captain_player_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists competitive_teams_name_unique
  on public.competitive_teams (lower(name));
create unique index if not exists competitive_teams_tag_unique
  on public.competitive_teams (lower(tag));
create unique index if not exists competitive_teams_owner_unique
  on public.competitive_teams (owner_account_id);

create table if not exists public.competitive_team_members (
  team_id uuid not null references public.competitive_teams(id) on delete cascade,
  player_id text not null,
  role text not null default 'member' check (role in ('captain','member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, player_id)
);

-- A player can belong to one active competitive team at a time.
create unique index if not exists competitive_team_members_player_unique
  on public.competitive_team_members (player_id);

create index if not exists competitive_team_members_team_idx
  on public.competitive_team_members (team_id, joined_at asc);

alter table public.competitive_teams enable row level security;
alter table public.competitive_team_members enable row level security;
revoke all on table public.competitive_teams from anon, authenticated;
revoke all on table public.competitive_team_members from anon, authenticated;
grant select, insert, update, delete on table public.competitive_teams to service_role;
grant select, insert, update, delete on table public.competitive_team_members to service_role;

-- Reads and writes are mediated by the mucho8s-teams Edge Function.
