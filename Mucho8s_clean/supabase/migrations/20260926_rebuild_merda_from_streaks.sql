-- Rebuild MERDA history from the actual streak rule:
-- every 4 consecutive losses awards 1 MERDA;
-- every 4 consecutive wins clears 1 active MERDA.
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
  v_awarded_ids jsonb;
  v_cleared_ids jsonb;
  v_saved_awarded jsonb;
  v_saved_cleared jsonb;
begin
  select players, matches
    into v_players, v_matches
  from public.app_state
  where id = 'main'
  for update;

  if v_players is null or v_matches is null then
    return;
  end if;

  create temporary table tmp_merda_rebuild_state (
    player_id text primary key,
    streak integer not null default 0,
    merda_count integer not null default 0
  ) on commit drop;

  create temporary table tmp_merda_rebuild_matches (
    match_id text primary key,
    awarded_ids jsonb not null default '[]'::jsonb,
    cleared_ids jsonb not null default '[]'::jsonb
  ) on commit drop;

  insert into tmp_merda_rebuild_state (player_id)
  select value->>'id'
  from jsonb_array_elements(v_players)
  where coalesce(value->>'id','') <> '';

  for v_match in
    select value
    from jsonb_array_elements(v_matches)
    order by coalesce((value->>'date')::timestamptz, 'epoch'::timestamptz) asc
  loop
    v_match_id := coalesce(v_match->>'id','');
    v_awarded_ids := '[]'::jsonb;
    v_cleared_ids := '[]'::jsonb;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_match->'teamA', '[]'::jsonb))
      union all
      select jsonb_array_elements_text(coalesce(v_match->'teamB', '[]'::jsonb))
    loop
      select streak, merda_count
        into v_streak, v_count
      from tmp_merda_rebuild_state
      where player_id = v_player_id;

      if not found then
        insert into tmp_merda_rebuild_state(player_id, streak, merda_count)
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

        if v_new_streak >= 4
           and mod(v_new_streak, 4) = 0
           and v_count > 0 then
          v_count := v_count - 1;
          v_cleared_ids := v_cleared_ids || jsonb_build_array(v_player_id);
        end if;
      else
        v_new_streak := case when v_streak < 0 then v_streak - 1 else -1 end;

        if abs(v_new_streak) >= 4
           and mod(abs(v_new_streak), 4) = 0 then
          v_count := v_count + 1;
          v_awarded_ids := v_awarded_ids || jsonb_build_array(v_player_id);
        end if;
      end if;

      update tmp_merda_rebuild_state
      set streak = v_new_streak,
          merda_count = v_count
      where player_id = v_player_id;
    end loop;

    if v_match_id <> '' then
      insert into tmp_merda_rebuild_matches(match_id, awarded_ids, cleared_ids)
      values (v_match_id, v_awarded_ids, v_cleared_ids)
      on conflict (match_id) do update
      set
        awarded_ids = excluded.awarded_ids,
        cleared_ids = excluded.cleared_ids;
    end if;
  end loop;

  for v_player in
    select value
    from jsonb_array_elements(v_players)
  loop
    select streak, merda_count
      into v_streak, v_count
    from tmp_merda_rebuild_state
    where player_id = v_player->>'id';

    v_player := jsonb_set(
      v_player,
      '{merdaCount}',
      to_jsonb(greatest(0, coalesce(v_count, 0))),
      true
    );
    v_player := jsonb_set(
      v_player,
      '{currentStreak}',
      to_jsonb(coalesce(v_streak, 0)),
      true
    );

    v_next_players := v_next_players || jsonb_build_array(v_player);
  end loop;

  for v_match in
    select value
    from jsonb_array_elements(v_matches)
  loop
    select awarded_ids, cleared_ids
      into v_saved_awarded, v_saved_cleared
    from tmp_merda_rebuild_matches
    where match_id = v_match->>'id';

    v_saved_awarded := coalesce(v_saved_awarded, '[]'::jsonb);
    v_saved_cleared := coalesce(v_saved_cleared, '[]'::jsonb);

    v_match := jsonb_set(v_match, '{merdaIds}', v_saved_awarded, true);
    v_match := jsonb_set(
      v_match,
      '{merdaId}',
      case
        when jsonb_array_length(v_saved_awarded) > 0 then v_saved_awarded->0
        else 'null'::jsonb
      end,
      true
    );
    v_match := jsonb_set(v_match, '{merdaClearedIds}', v_saved_cleared, true);

    v_next_matches := v_next_matches || jsonb_build_array(v_match);
  end loop;

  update public.app_state
  set
    players = v_next_players,
    matches = v_next_matches,
    version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = now()
  where id = 'main';

  update public.team_match_reports r
  set merda_id = rebuilt.merda_id
  from (
    select
      m->>'id' as match_id,
      m->'merdaIds'->>0 as merda_id
    from jsonb_array_elements(v_next_matches) m
  ) rebuilt
  where r.match_id::text = rebuilt.match_id;
end;
$$;
