-- Dynamic Elo rule for Mucho1v1 / challenge results.
-- Equal Elo remains worth 25 base points.
-- Upset wins are worth more; expected wins are worth less.
-- K=50, scale=400, result component clamped to 5..45.
-- Money value remains 1 EUR = 1 Elo and is added on top.
-- Team match pairings keep base=0 here because their result Elo is applied by the team match itself.
-- This migration changes future/re-synced results only; it does not replay historical challenges.

create or replace function public.sync_challenge_elo(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.player_challenges%rowtype;
  v_old public.challenge_elo_events%rowtype;
  v_players jsonb;
  v_winner text;
  v_loser text;
  v_amount_points numeric;
  v_base_points numeric;
  v_points numeric;
  v_winner_before numeric;
  v_loser_before numeric;
  v_expected_winner numeric;
  v_loser_after numeric;
  v_winner_delta numeric;
  v_loser_delta numeric;
begin
  select * into v_challenge
  from public.player_challenges
  where id = p_challenge_id
  for update;

  if not found then
    return;
  end if;

  select * into v_old
  from public.challenge_elo_events
  where challenge_id = p_challenge_id;

  select players into v_players
  from public.app_state
  where id = 'main'
  for update;

  if v_players is null then
    return;
  end if;

  -- Undo the previous event first so a re-sync remains idempotent.
  if v_old.challenge_id is not null then
    v_players := public.adjust_player_elo_json(
      v_players,
      v_old.winner_player_id,
      -v_old.winner_delta,
      false
    );
    v_players := public.adjust_player_elo_json(
      v_players,
      v_old.loser_player_id,
      -v_old.loser_delta,
      false
    );
  end if;

  if v_challenge.status = 'completed'
     and v_challenge.verified_at is not null
     and v_challenge.reported_winner_player_id is not null
     and v_challenge.amount_cents > 0 then

    v_winner := v_challenge.reported_winner_player_id;
    v_loser := case
      when v_winner = v_challenge.challenger_player_id then v_challenge.challenged_player_id
      else v_challenge.challenger_player_id
    end;

    select coalesce(nullif(value->>'currentElo','')::numeric, 1000)
      into v_winner_before
    from jsonb_array_elements(v_players)
    where value->>'id' = v_winner
    limit 1;

    select coalesce(nullif(value->>'currentElo','')::numeric, 1000)
      into v_loser_before
    from jsonb_array_elements(v_players)
    where value->>'id' = v_loser
    limit 1;

    if v_winner_before is not null and v_loser_before is not null then
      v_amount_points := round(v_challenge.amount_cents::numeric / 100);

      if v_challenge.source = 'match_pairing' then
        v_base_points := 0;
      else
        v_expected_winner :=
          1 / (1 + power(10::numeric, (v_loser_before - v_winner_before) / 400));

        v_base_points := greatest(
          5,
          least(
            45,
            round(50 * (1 - v_expected_winner))
          )
        );
      end if;

      v_points := v_base_points + v_amount_points;
      v_winner_delta := v_points;
      v_loser_after := greatest(500, v_loser_before - v_points);
      v_loser_delta := v_loser_after - v_loser_before;

      v_players := public.adjust_player_elo_json(
        v_players,
        v_winner,
        v_winner_delta,
        true
      );
      v_players := public.adjust_player_elo_json(
        v_players,
        v_loser,
        v_loser_delta,
        false
      );

      insert into public.challenge_elo_events (
        challenge_id,
        winner_player_id,
        loser_player_id,
        points,
        winner_delta,
        loser_delta,
        updated_at
      )
      values (
        p_challenge_id,
        v_winner,
        v_loser,
        v_points,
        v_winner_delta,
        v_loser_delta,
        now()
      )
      on conflict (challenge_id) do update set
        winner_player_id = excluded.winner_player_id,
        loser_player_id = excluded.loser_player_id,
        points = excluded.points,
        winner_delta = excluded.winner_delta,
        loser_delta = excluded.loser_delta,
        updated_at = now();
    end if;
  else
    delete from public.challenge_elo_events
    where challenge_id = p_challenge_id;
  end if;

  update public.app_state
  set
    players = v_players,
    version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = now()
  where id = 'main';
end;
$$;

revoke all on function public.sync_challenge_elo(uuid) from public, anon, authenticated;
grant execute on function public.sync_challenge_elo(uuid) to service_role;
