-- Mucho8s shared state for Supabase
create table if not exists public.app_state (
  id text primary key,
  players jsonb not null default '[]'::jsonb,
  matches jsonb not null default '[]'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, players, matches, version)
values ('main', '[]'::jsonb, '[]'::jsonb, 0)
on conflict (id) do nothing;

alter table public.app_state enable row level security;

drop policy if exists "Public read Mucho8s state" on public.app_state;
create policy "Public read Mucho8s state"
on public.app_state
for select
using (true);

-- No anonymous INSERT/UPDATE/DELETE policy is created.
-- Writes are performed only by the mucho8s-write Edge Function with the service role.


-- Discord webhook configuration.
-- The webhook URL is server-only: anonymous/authenticated clients have no table privileges.
create table if not exists public.discord_config (
  id text primary key,
  webhook_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.discord_config enable row level security;
revoke all on table public.discord_config from anon, authenticated;


-- Discord-authenticated player accounts.
-- Access is mediated by the mucho8s-account Edge Function.
create table if not exists public.player_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique,
  discord_username text,
  display_name text,
  avatar_url text,
  player_id text unique,
  paypal_url text,
  revolut_url text,
  cmg_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_accounts enable row level security;
revoke all on table public.player_accounts from anon, authenticated;


-- Player-to-player challenges with CMG-style result verification.
-- All access is mediated by the mucho8s-challenges Edge Function.
create table if not exists public.player_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_account_id uuid references auth.users(id) on delete cascade,
  challenger_player_id text not null,
  challenged_account_id uuid references auth.users(id) on delete cascade,
  challenged_player_id text not null,
  platform text not null check (platform in ('paypal','revolut','cmg')),
  target_url text not null,
  challenger_payout_url text,
  challenged_payout_url text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'EUR',
  payment_sent_at timestamptz,
  payment_received_at timestamptz,
  payout_disputed_at timestamptz,
  payout_dispute_note text,
  payout_dispute_resolved_at timestamptz,
  payout_dispute_resolution text,
  challenger_ready_at timestamptz,
  challenged_ready_at timestamptz,
  status text not null default 'pending' check (status in (
    'pending','accepted','declined','result_pending','completed','disputed','cancelled'
  )),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  challenger_seen_at timestamptz,
  challenger_seen_status text,
  challenged_seen_status text,
  last_event text,
  challenger_seen_event text,
  challenged_seen_event text,
  reported_winner_player_id text,
  reporter_account_id uuid references auth.users(id) on delete set null,
  result_reported_at timestamptz,
  verified_at timestamptz,
  verifier_account_id uuid references auth.users(id) on delete set null,
  dispute_note text,
  season_number integer not null default 1,
  evidence jsonb not null default '[]'::jsonb,
  source text not null default 'direct',
  match_id text,
  pairing_key text
);

create index if not exists player_challenges_challenged_pending_idx
  on public.player_challenges (challenged_account_id, status, created_at desc);

create index if not exists player_challenges_challenger_updates_idx
  on public.player_challenges (challenger_account_id, challenger_seen_at, responded_at desc);

create index if not exists player_challenges_match_pairing_idx
  on public.player_challenges (source, match_id);

create unique index if not exists player_challenges_match_pairing_unique_idx
  on public.player_challenges (match_id, pairing_key)
  where source = 'match_pairing' and match_id is not null and pairing_key is not null;

alter table public.player_challenges enable row level security;
revoke all on table public.player_challenges from anon, authenticated;


-- Persistent admin audit trail.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;


-- Presence for Discord-linked players shown as online on the dashboard.
create table if not exists public.player_presence (
  account_id uuid primary key references public.player_accounts(id) on delete cascade,
  player_id text not null,
  last_seen_at timestamptz not null default now()
);

create index if not exists player_presence_last_seen_idx
  on public.player_presence (last_seen_at desc);

alter table public.player_presence enable row level security;
revoke all on table public.player_presence from anon, authenticated;


-- Discord player allowlist for automatic Admin access.
create table if not exists public.admin_access (
  player_id text primary key,
  username text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_access enable row level security;
revoke all on table public.admin_access from anon, authenticated;

insert into public.admin_access (player_id, username, display_name, is_active)
values
  ('e9892a93-551f-441b-9122-91336f193075', 'sharhy', 'Sharhy', true),
  ('37317bcc-1cf9-4410-8934-ec82f9b68ec4', 'sysma', 'SysMa', true)
on conflict (player_id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  is_active = true,
  updated_at = now();


-- Server-side Admin authentication.
create table if not exists public.admin_credentials (
  username text primary key,
  password_hash text not null,
  password_scheme text not null default 'legacy_sha256',
  password_salt text,
  password_iterations integer,
  is_active boolean not null default true,
  required_account_id uuid references public.player_accounts(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  token_hash text primary key,
  username text not null references public.admin_credentials(username) on delete cascade,
  account_id uuid references public.player_accounts(id) on delete cascade,
  user_agent_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.admin_login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  client_key_hash text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_sessions_username_idx on public.admin_sessions (username, expires_at desc);
create index if not exists admin_sessions_expiry_idx on public.admin_sessions (expires_at);
create index if not exists admin_login_attempts_rate_idx on public.admin_login_attempts (username, client_key_hash, created_at desc);

alter table public.admin_credentials enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_login_attempts enable row level security;

revoke all on table public.admin_credentials from anon, authenticated;
revoke all on table public.admin_sessions from anon, authenticated;
revoke all on table public.admin_login_attempts from anon, authenticated;


-- Competition seasons and archives.
create table if not exists public.competition_config (
  id text primary key,
  season_number integer not null default 1,
  season_name text not null default 'Season 1',
  season_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.competition_config (id, season_number, season_name)
values ('main', 1, 'Season 1')
on conflict (id) do nothing;

create table if not exists public.season_archives (
  id bigint generated always as identity primary key,
  season_number integer not null unique,
  season_name text not null,
  started_at timestamptz,
  ended_at timestamptz not null default now(),
  players jsonb not null default '[]'::jsonb,
  matches jsonb not null default '[]'::jsonb,
  challenge_stats jsonb not null default '{}'::jsonb
);

alter table public.competition_config enable row level security;
alter table public.season_archives enable row level security;
revoke all on table public.competition_config from anon, authenticated;
revoke all on table public.season_archives from anon, authenticated;


-- Private evidence bucket for challenge/result/payment disputes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'challenge-evidence',
  'challenge-evidence',
  false,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- Team match result verification. A captain/Admin reports the result; the opposite captain confirms.
create table if not exists public.team_match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id text not null unique,
  team_a jsonb not null default '[]'::jsonb,
  team_b jsonb not null default '[]'::jsonb,
  winner text not null check (winner in ('A','B')),
  score_a integer not null default 0 check (score_a >= 0),
  score_b integer not null default 0 check (score_b >= 0),
  mvp_id text,
  game text,
  mode text,
  map text,
  pairings jsonb not null default '[]'::jsonb,
  season_number integer not null default 1,
  captain_a_player_id text not null,
  captain_b_player_id text not null,
  reporter_account_id uuid references auth.users(id) on delete set null,
  reporter_player_id text,
  reporter_is_admin boolean not null default false,
  status text not null default 'pending' check (status in ('pending','completed','disputed','cancelled')),
  verifier_account_id uuid references auth.users(id) on delete set null,
  verifier_player_id text,
  dispute_note text,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  locked_at timestamptz
);

create index if not exists team_match_reports_status_idx
  on public.team_match_reports (status, created_at desc);

create index if not exists team_match_reports_captain_a_idx
  on public.team_match_reports (captain_a_player_id, created_at desc);

create index if not exists team_match_reports_captain_b_idx
  on public.team_match_reports (captain_b_player_id, created_at desc);

alter table public.team_match_reports enable row level security;
revoke all on table public.team_match_reports from anon, authenticated;
