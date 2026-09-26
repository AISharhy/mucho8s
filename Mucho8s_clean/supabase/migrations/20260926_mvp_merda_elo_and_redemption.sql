-- MVP is worth +3 Elo and MERDA is worth -3 Elo.
-- A MERDA count is cleared at matching 4-win streak milestones.

do $$
declare
  v_players jsonb;
  v_matches jsonb;
  v_next_players jsonb := '[]'::jsonb;
  v_next_matches jsonb := '[]'::jsonb;
  v_player jsonb;
  v_match jsonb;
  v_player_id text;
  v_match_id text;
  v_streak integer;
  v_count integer;
  v_new_streak integer;
  v_won boolean;
  v_awarded boolean;
  v_clear_ids jsonb;
  v_saved_clear_ids jsonb;
  v_changes jsonb;
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

  create temporary table tmp_merda_state (
    player_id text primary key,
    streak integer not null default 0,
    merda_count integer not null default 0
  ) on commit drop;

  create temporary table tmp_merda_clears (
    match_id text primary key,
    cleared_ids jsonb not null default '[]'::jsonb
  ) on commit drop;

  insert into tmp_merda_state (player_id)
  select value->>'id'
  from jsonb_array_elements(v_players)
  where coalesce(value->>'id','') <> '';

  for v_match in
    select value
    from jsonb_array_elements(v_matches)
    order by coalesce((value->>'date')::timestamptz, 'epoch'::timestamptz) asc
  loop
    v_match_id := coalesce(v_match->>'id','');
    v_clear_ids := '[]'::jsonb;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_match->'teamA', '[]'::jsonb))
      union all
      select jsonb_array_elements_text(coalesce(v_match->'teamB', '[]'::jsonb))
    loop
      select streak, merda_count
        into v_streak, v_count
      from tmp_merda_state
      where player_id = v_player_id;

      if not found then
        insert into tmp_merda_state(player_id, streak, merda_count)
        values (v_player_id, 0, 0)
        on conflict (player_id) do nothing;
        v_streak := 0;
        v_count := 0;
      end if;

      v_won :=
        (v_match->>'winner' = 'A' and coalesce(v_match->'teamA','[]'::jsonb) ? v_player_id)
        or
        (v_match->>'winner' = 'B' and coalesce(v_match->'teamB','[]'::jsonb) ? v_player_id);

      if v_won then
        v_new_streak := case when v_streak > 0 then v_streak + 1 else 1 end;
      else
        v_new_streak := case when v_streak < 0 then v_streak - 1 else -1 end;
      end if;

      v_awarded :=
        coalesce(v_match->'merdaIds','[]'::jsonb) ? v_player_id
        or coalesce(v_match->>'merdaId','') = v_player_id;

      if v_awarded then
        v_count := v_count + 1;
      end if;

      if v_won
         and v_new_streak >= 4
         and mod(v_new_streak, 4) = 0
         and v_count > 0 then
        v_count := v_count - 1;
        v_clear_ids := v_clear_ids || jsonb_build_array(v_player_id);
      end if;

      update tmp_merda_state
      set streak = v_new_streak,
          merda_count = v_count
      where player_id = v_player_id;
    end loop;

    if v_match_id <> '' then
      insert into tmp_merda_clears(match_id, cleared_ids)
      values (v_match_id, v_clear_ids)
      on conflict (match_id) do update
      set cleared_ids = excluded.cleared_ids;
    end if;
  end loop;

  for v_player in
    select value
    from jsonb_array_elements(v_players)
  loop
    select merda_count
      into v_count
    from tmp_merda_state
    where player_id = v_player->>'id';

    v_player := jsonb_set(
      v_player,
      '{merdaCount}',
      to_jsonb(greatest(0, coalesce(v_count, 0))),
      true
    );
    v_next_players := v_next_players || jsonb_build_array(v_player);
  end loop;

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
      if coalesce(v_match->'merdaIds','[]'::jsonb) ? v_player_id
         or coalesce(v_match->>'merdaId','') = v_player_id then
        v_new_delta := v_new_delta - 3;
      end if;

      v_old_delta := coalesce(nullif(v_match->'eloChanges'->>v_player_id, '')::numeric, 0);
      if v_old_delta <> 0 and v_old_delta <> v_new_delta then
        v_next_players := public.adjust_player_elo_json(
          v_next_players,
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
      if coalesce(v_match->'merdaIds','[]'::jsonb) ? v_player_id
         or coalesce(v_match->>'merdaId','') = v_player_id then
        v_new_delta := v_new_delta - 3;
      end if;

      v_old_delta := coalesce(nullif(v_match->'eloChanges'->>v_player_id, '')::numeric, 0);
      if v_old_delta <> 0 and v_old_delta <> v_new_delta then
        v_next_players := public.adjust_player_elo_json(
          v_next_players,
          v_player_id,
          v_new_delta - v_old_delta,
          (v_new_delta - v_old_delta) > 0
        );
      end if;
      v_changes := jsonb_set(v_changes, array[v_player_id], to_jsonb(v_new_delta), true);
    end loop;

    select cleared_ids
      into v_saved_clear_ids
    from tmp_merda_clears
    where match_id = v_match->>'id';

    v_match := jsonb_set(v_match, '{eloChanges}', v_changes, true);
    v_match := jsonb_set(
      v_match,
      '{merdaClearedIds}',
      coalesce(v_saved_clear_ids, '[]'::jsonb),
      true
    );
    v_next_matches := v_next_matches || jsonb_build_array(v_match);
  end loop;

  update public.app_state
  set
    players = v_next_players,
    matches = v_next_matches,
    version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = now()
  where id = 'main';
end;
$$;
