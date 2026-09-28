create table if not exists public.live_match_messages (
  id uuid primary key default gen_random_uuid(),
  live_match_id uuid not null references public.live_team_matches(id) on delete cascade,
  sender_account_id uuid references auth.users(id) on delete set null,
  sender_player_id text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists live_match_messages_match_created_idx
  on public.live_match_messages (live_match_id, created_at asc);

alter table public.live_match_messages enable row level security;
revoke all on table public.live_match_messages from anon, authenticated;
