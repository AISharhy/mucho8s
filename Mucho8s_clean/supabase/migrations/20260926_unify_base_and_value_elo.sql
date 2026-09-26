-- Unified Elo rule:
-- every result is worth 25 base Elo;
-- the rounded challenge value is added to that base.
-- Team-match pairings receive their 25 base Elo from the team match itself,
-- so challenge_elo_events only adds the pairing value for source=match_pairing.

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
  v_points numeric;
  v_winner_before numeric;
  v_loser_before numeric;
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

  if v_old.challenge_id is not null then
    v_players := public.adjust_player_elo_json(v_players, v_old.winner_player_id, -v_old.winner_delta, false);
    v_players := public.adjust_player_elo_json(v_players, v_old.loser_player_id, -v_old.loser_delta, false);
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

    v_amount_points := round(v_challenge.amount_cents::numeric / 100);
    v_points := v_amount_points
      + case when v_challenge.source = 'match_pairing' then 0 else 25 end;

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
      v_winner_delta := v_points;
      v_loser_after := greatest(500, v_loser_before - v_points);
      v_loser_delta := v_loser_after - v_loser_before;

      v_players := public.adjust_player_elo_json(v_players, v_winner, v_winner_delta, true);
      v_players := public.adjust_player_elo_json(v_players, v_loser, v_loser_delta, false);

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
    delete from public.challenge_elo_events where challenge_id = p_challenge_id;
  end if;

  update public.app_state
  set
    players = v_players,
    version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = now()
  where id = 'main';
end;
$$;

do $$
declare
  v_id uuid;
begin
  for v_id in
    select id
    from public.player_challenges
    where status = 'completed'
      and verified_at is not null
      and reported_winner_player_id is not null
      and amount_cents > 0
  loop
    perform public.sync_challenge_elo(v_id);
  end loop;
end;
$$;

do $$
declare
  v_players jsonb;
  v_matches jsonb;
  v_next_matches jsonb := '[]'::jsonb;
  v_match jsonb;
  v_changes jsonb;
  v_player_id text;
  v_old_delta numeric;
  v_new_delta numeric;
begin
  select players, matches
    into v_players, v_matches
  from public.app_state
  where id = 'main'
  for update;

  if v_players is null or v_matches is null then
    return;
  end if;

  for v_match in
    select value
    from jsonb_array_elements(v_matches)
  loop
    v_changes := '{}'::jsonb;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_match->'teamA', '[]'::jsonb))
    loop
      v_new_delta := case when v_match->>'winner' = 'A' then 25 else -25 end;
      v_old_delta := coalesce(nullif(v_match->'eloChanges'->>v_player_id, '')::numeric, 0);
      if v_old_delta <> 0 and v_old_delta <> v_new_delta then
        v_players := public.adjust_player_elo_json(v_players, v_player_id, v_new_delta - v_old_delta, false);
      end if;
      v_changes := jsonb_set(v_changes, array[v_player_id], to_jsonb(v_new_delta), true);
    end loop;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_match->'teamB', '[]'::jsonb))
    loop
      v_new_delta := case when v_match->>'winner' = 'B' then 25 else -25 end;
      v_old_delta := coalesce(nullif(v_match->'eloChanges'->>v_player_id, '')::numeric, 0);
      if v_old_delta <> 0 and v_old_delta <> v_new_delta then
        v_players := public.adjust_player_elo_json(v_players, v_player_id, v_new_delta - v_old_delta, false);
      end if;
      v_changes := jsonb_set(v_changes, array[v_player_id], to_jsonb(v_new_delta), true);
    end loop;

    v_match := jsonb_set(v_match, '{eloChanges}', v_changes, true);
    v_next_matches := v_next_matches || jsonb_build_array(v_match);
  end loop;

  update public.app_state
  set
    players = v_players,
    matches = v_next_matches,
    version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = now()
  where id = 'main';
end;
$$;
