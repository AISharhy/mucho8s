-- Editable competition rules controlled from Admin > Competition.

alter table public.competition_config
  add column if not exists starting_elo integer not null default 500,
  add column if not exists rollover_mode text not null default 'monthly',
  add column if not exists rollover_day integer not null default 1,
  add column if not exists leaderboard_min_matches integer not null default 1;

alter table public.competition_config
  drop constraint if exists competition_config_starting_elo_check,
  add constraint competition_config_starting_elo_check
    check (starting_elo between 500 and 3000),
  drop constraint if exists competition_config_rollover_mode_check,
  add constraint competition_config_rollover_mode_check
    check (rollover_mode in ('monthly', 'manual')),
  drop constraint if exists competition_config_rollover_day_check,
  add constraint competition_config_rollover_day_check
    check (rollover_day between 1 and 28),
  drop constraint if exists competition_config_leaderboard_min_matches_check,
  add constraint competition_config_leaderboard_min_matches_check
    check (leaderboard_min_matches between 0 and 100);

update public.competition_config
set
  starting_elo = coalesce(starting_elo, 500),
  rollover_mode = coalesce(nullif(rollover_mode, ''), 'monthly'),
  rollover_day = coalesce(rollover_day, 1),
  leaderboard_min_matches = coalesce(leaderboard_min_matches, 1)
where id = 'main';

create or replace function public.rollover_monthly_season_if_due()
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_config public.competition_config%rowtype;
  v_players jsonb;
  v_matches jsonb;
  v_reset_players jsonb;
  v_local_now timestamp;
  v_started_local timestamp;
  v_completed integer := 0;
  v_settled integer := 0;
  v_volume_cents bigint := 0;
  v_next_season integer;
  v_now timestamptz := now();
  v_starting_elo integer;
begin
  select *
    into v_config
  from public.competition_config
  where id = 'main'
  for update;

  if not found then
    return false;
  end if;

  if coalesce(v_config.rollover_mode, 'monthly') <> 'monthly' then
    return false;
  end if;

  v_local_now := timezone('Europe/Rome', v_now);
  v_started_local := timezone('Europe/Rome', v_config.season_started_at);
  v_starting_elo := greatest(500, coalesce(v_config.starting_elo, 500));

  -- Job runs hourly. Rollover happens only on the configured day of a new month.
  if extract(day from v_local_now) <> coalesce(v_config.rollover_day, 1)
     or date_trunc('month', v_local_now) <= date_trunc('month', v_started_local) then
    return false;
  end if;

  select players, matches
    into v_players, v_matches
  from public.app_state
  where id = 'main'
  for update;

  v_players := coalesce(v_players, '[]'::jsonb);
  v_matches := coalesce(v_matches, '[]'::jsonb);

  select
    count(*) filter (where status = 'completed')::integer,
    count(*) filter (
      where status = 'completed'
        and payment_received_at is not null
    )::integer,
    coalesce(
      sum(amount_cents) filter (
        where status = 'completed'
          and payment_received_at is not null
      ),
      0
    )::bigint
    into v_completed, v_settled, v_volume_cents
  from public.player_challenges
  where season_number = v_config.season_number;

  insert into public.season_archives (
    season_number,
    season_name,
    started_at,
    ended_at,
    players,
    matches,
    challenge_stats
  )
  values (
    v_config.season_number,
    v_config.season_name,
    v_config.season_started_at,
    v_now,
    v_players,
    v_matches,
    jsonb_build_object(
      'completed', v_completed,
      'settled', v_settled,
      'volume_cents', v_volume_cents
    )
  )
  on conflict (season_number) do update set
    season_name = excluded.season_name,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    players = excluded.players,
    matches = excluded.matches,
    challenge_stats = excluded.challenge_stats;

  select coalesce(
    jsonb_agg(
      value || jsonb_build_object(
        'currentElo', v_starting_elo,
        'peakElo', v_starting_elo,
        'totalMatches', 0,
        'wins', 0,
        'losses', 0,
        'avgPlacement', 0,
        'last10', '[]'::jsonb,
        'currentStreak', 0,
        'mvpCount', 0,
        'merdaCount', 0,
        'eloHistory', jsonb_build_array(jsonb_build_object('match', 0, 'elo', v_starting_elo))
      )
    ),
    '[]'::jsonb
  )
  into v_reset_players
  from jsonb_array_elements(v_players);

  update public.app_state
  set
    players = v_reset_players,
    matches = '[]'::jsonb,
    version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = v_now
  where id = 'main';

  v_next_season := v_config.season_number + 1;

  update public.competition_config
  set
    season_number = v_next_season,
    season_name = 'Season ' || v_next_season,
    season_started_at = v_now,
    updated_at = v_now
  where id = 'main';

  insert into public.admin_audit_log (
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    'season.auto_start',
    'season',
    v_next_season::text,
    jsonb_build_object(
      'previous_season', v_config.season_number,
      'previous_name', v_config.season_name,
      'start_elo', v_starting_elo,
      'cadence', v_config.rollover_mode,
      'rollover_day', v_config.rollover_day,
      'timezone', 'Europe/Rome'
    )
  );

  return true;
end;
$$;

revoke all on function public.rollover_monthly_season_if_due() from public, anon, authenticated;
grant execute on function public.rollover_monthly_season_if_due() to service_role;
