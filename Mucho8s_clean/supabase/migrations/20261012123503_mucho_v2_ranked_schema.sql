-- Additive changes: existing matches, ratings, accounts and rosters are preserved.
create unique index if not exists team_match_reports_match_id_unique on public.team_match_reports(match_id);
alter table public.ranked_lobbies drop constraint ranked_lobbies_status_check;
alter table public.ranked_lobbies add constraint ranked_lobbies_status_check check(status in ('draft','vote','lobby','ready','live','pending','disputed','cancelled','completed'));
alter table public.ranked_lobbies add column if not exists preparation_started_at timestamptz;
alter table public.ranked_lobbies add column if not exists preparation_deadline timestamptz;
alter table public.ranked_lobbies add column if not exists phase_deadline timestamptz;
alter table public.ranked_lobbies add column if not exists draft_pick integer not null default 0;
alter table public.ranked_lobbies add column if not exists host_player_id text;
alter table public.ranked_lobbies add column if not exists host_changed boolean not null default false;
alter table public.ranked_lobbies add column if not exists cancellation_reason text;
alter table public.ranked_lobbies add column if not exists report_id uuid references public.team_match_reports(id);
alter table public.ranked_queue add column if not exists last_seen_at timestamptz not null default now();
alter table public.ranked_lobby_players add column if not exists last_seen_at timestamptz not null default now();
