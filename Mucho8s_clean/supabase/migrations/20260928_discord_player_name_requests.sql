alter table public.player_accounts
  add column if not exists requested_player_name text,
  add column if not exists player_request_status text,
  add column if not exists player_request_requested_at timestamptz,
  add column if not exists player_request_reviewed_at timestamptz,
  add column if not exists player_request_reviewed_by text;

alter table public.player_accounts
  drop constraint if exists player_accounts_player_request_status_check;

alter table public.player_accounts
  add constraint player_accounts_player_request_status_check
  check (
    player_request_status is null
    or player_request_status in ('pending','approved','rejected')
  );

create index if not exists player_accounts_player_request_status_idx
  on public.player_accounts(player_request_status, player_request_requested_at desc);
