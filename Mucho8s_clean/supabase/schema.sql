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
