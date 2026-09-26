-- Private text chat for accepted 1v1 challenges.
create table if not exists public.challenge_messages (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.player_challenges(id) on delete cascade,
  sender_account_id uuid not null references auth.users(id) on delete cascade,
  sender_player_id text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists challenge_messages_challenge_created_idx
  on public.challenge_messages (challenge_id, created_at asc);

alter table public.challenge_messages enable row level security;
revoke all on table public.challenge_messages from anon, authenticated;
