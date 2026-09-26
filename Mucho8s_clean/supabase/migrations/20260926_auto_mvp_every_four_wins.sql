-- MVP is automatic: every 4 consecutive wins awards 1 MVP and +3 Elo.
-- Rebuild historical MVP awards and remove all manual MVP assignments.

alter table public.team_match_reports
  add column if not exists mvp_ids jsonb not null default '[]'::jsonb;

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
  v_next_streak integer;
  v_won boolean;
  v_mvp_ids jsonb;
  v_saved_mvp_ids jsonb;
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

  create temporary table tmp_mvp_state (
    player_id text primary key,
    streak integer not null default 0,
    mvp_count integer not null default 0
  ) on commit drop;

  create temporary table tmp_match_mvps (
    match_id text primary key,
    mvp_ids jsonb not null default '[]'::jsonb
  ) on commit drop;

  insert into tmp_mvp_state (player_id)
  select value->>'id'
  from jsonb_array_elements(v_players)
  where coalesce(value->>'id','') <> '';

  for v_match in
    select value
    from jsonb_array_elements(v_matches)
    order by
      coalesce((value->>'date')::timestamptz, 'epoch'::timestamptz) asc,
      value->>'id' asc
  loop
    v_match_id := coalesce(v_match->>'id','');
    v_mvp_ids := '[]'::jsonb;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_match->'teamA', '[]'::jsonb))
      union all
      select jsonb_array_elements_text(coalesce(v_match->'teamB', '[]'::jsonb))
    loop
      select streak, mvp_count
        into v_streak, v_count
      from tmp_mvp_state
      where player_id = v_player_id;

      if not found then
        insert into tmp_mvp_state(player_id, streak, mvp_count)
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
        v_next_streak := case when v_streak > 0 then v_streak + 1 else 1 end;
      else
        v_next_streak := case when v_streak < 0 then v_streak - 1 else -1 end;
      end if;

      if v_won
         and v_next_streak >= 4
         and mod(v_next_streak, 4) = 0 then
        v_count := v_count + 1;
        v_mvp_ids := v_mvp_ids || jsonb_build_array(v_player_id);
      end if;

      update tmp_mvp_state
      set streak = v_next_streak,
          mvp_count = v_count
      where player_id = v_player_id;
    end loop;

    if v_match_id <> '' then
      insert into tmp_match_mvps(match_id, mvp_ids)
      values (v_match_id, v_mvp_ids)
      on conflict (match_id) do update
      set mvp_ids = excluded.mvp_ids;
    end if;
  end loop;

  for v_player in
    select value
    from jsonb_array_elements(v_players)
  loop
    select mvp_count
      into v_count
    from tmp_mvp_state
    where player_id = v_player->>'id';

    v_player := jsonb_set(
      v_player,
      '{mvpCount}',
      to_jsonb(greatest(0, coalesce(v_count, 0))),
      true
    );

    v_next_players := v_next_players || jsonb_build_array(v_player);
  end loop;

  for v_match in
    select value
    from jsonb_array_elements(v_matches)
  loop
    select mvp_ids
      into v_saved_mvp_ids
    from tmp_match_mvps
    where match_id = v_match->>'id';

    v_saved_mvp_ids := coalesce(v_saved_mvp_ids, '[]'::jsonb);
    v_changes := '{}'::jsonb;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_match->'teamA', '[]'::jsonb))
    loop
      v_new_delta := case when v_match->>'winner' = 'A' then 25 else -25 end;
      if v_saved_mvp_ids ? v_player_id then
        v_new_delta := v_new_delta + 3;
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
      if v_saved_mvp_ids ? v_player_id then
        v_new_delta := v_new_delta + 3;
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

    v_match := jsonb_set(v_match, '{mvpIds}', v_saved_mvp_ids, true);
    v_match := jsonb_set(
      v_match,
      '{mvpId}',
      case
        when jsonb_array_length(v_saved_mvp_ids) > 0 then v_saved_mvp_ids->0
        else 'null'::jsonb
      end,
      true
    );
    v_match := jsonb_set(v_match, '{eloChanges}', v_changes, true);

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
  set
    mvp_ids = rebuilt.mvp_ids,
    mvp_id = rebuilt.mvp_ids->>0
  from (
    select
      m->>'id' as match_id,
      coalesce(m->'mvpIds','[]'::jsonb) as mvp_ids
    from jsonb_array_elements(v_next_matches) m
  ) rebuilt
  where r.match_id::text = rebuilt.match_id;

  update public.team_match_reports
  set
    mvp_id = null,
    mvp_ids = '[]'::jsonb
  where status <> 'completed';
end;
$$;
