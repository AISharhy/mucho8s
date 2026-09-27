-- Monthly competitive seasons.
-- Official cadence: first day of every calendar month in Europe/Rome.
-- On rollover, archive the completed season and reset competitive stats/Elo to Iron (500).

create extension if not exists pg_cron;

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
begin
  select *
    into v_config
  from public.competition_config
  where id = 'main'
  for update;

  if not found then
    return false;
  end if;

  v_local_now := timezone('Europe/Rome', v_now);
  v_started_local := timezone('Europe/Rome', v_config.season_started_at);

  -- The job runs hourly, but rolls over only once: on day 1 of a new month.
  if extract(day from v_local_now) <> 1
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
        'currentElo', 500,
        'peakElo', 500,
        'totalMatches', 0,
        'wins', 0,
        'losses', 0,
        'avgPlacement', 0,
        'last10', '[]'::jsonb,
        'currentStreak', 0,
        'mvpCount', 0,
        'merdaCount', 0,
        'eloHistory', jsonb_build_array(jsonb_build_object('match', 0, 'elo', 500))
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
      'start_elo', 500,
      'cadence', 'monthly',
      'timezone', 'Europe/Rome'
    )
  );

  return true;
end;
$$;

revoke all on function public.rollover_monthly_season_if_due() from public, anon, authenticated;
grant execute on function public.rollover_monthly_season_if_due() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
  from cron.job
  where jobname = 'mucho8s_monthly_season_rollover'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'mucho8s_monthly_season_rollover',
  '5 * * * *',
  'select public.rollover_monthly_season_if_due();'
);
