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
  challenger_account_id uuid not null references auth.users(id) on delete cascade,
  challenger_player_id text not null,
  challenged_account_id uuid not null references auth.users(id) on delete cascade,
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
  dispute_note text
);

create index if not exists player_challenges_challenged_pending_idx
  on public.player_challenges (challenged_account_id, status, created_at desc);

create index if not exists player_challenges_challenger_updates_idx
  on public.player_challenges (challenger_account_id, challenger_seen_at, responded_at desc);

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
