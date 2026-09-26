-- MERDA no longer changes Elo.
-- Keep MVP at +3, keep MERDA counts/redemption unchanged,
-- and restore historical Elo previously lost to the -3 MERDA penalty.

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
      if coalesce(v_match->>'mvpId','') = v_player_id then
        v_new_delta := v_new_delta + 3;
      end if;

      v_old_delta := coalesce(nullif(v_match->'eloChanges'->>v_player_id, '')::numeric, 0);

      if v_old_delta <> 0 and v_old_delta <> v_new_delta then
        v_players := public.adjust_player_elo_json(
          v_players,
          v_player_id,
          v_new_delta - v_old_delta,
          (v_new_delta - v_old_delta) > 0
        );
      end if;

      v_changes := jsonb_set(v_changes, array[v_player_id], to_jsonb(v_new_delta), true);
    end loop;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_match->'teamB', '[]'::jsonb))
    loop
      v_new_delta := case when v_match->>'winner' = 'B' then 25 else -25 end;
      if coalesce(v_match->>'mvpId','') = v_player_id then
        v_new_delta := v_new_delta + 3;
      end if;

      v_old_delta := coalesce(nullif(v_match->'eloChanges'->>v_player_id, '')::numeric, 0);

      if v_old_delta <> 0 and v_old_delta <> v_new_delta then
        v_players := public.adjust_player_elo_json(
          v_players,
          v_player_id,
          v_new_delta - v_old_delta,
          (v_new_delta - v_old_delta) > 0
        );
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
