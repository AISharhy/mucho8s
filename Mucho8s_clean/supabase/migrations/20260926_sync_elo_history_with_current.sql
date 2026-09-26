-- Keep the profile Elo chart aligned with challenge-driven Elo changes.
create or replace function public.adjust_player_elo_json(
  p_players jsonb,
  p_player_id text,
  p_delta numeric,
  p_raise_peak boolean default true
)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_player jsonb;
  v_current numeric;
  v_next numeric;
  v_peak numeric;
  v_history jsonb;
  v_last_index integer;
  v_match_no integer;
begin
  for v_player in
    select value from jsonb_array_elements(coalesce(p_players, '[]'::jsonb))
  loop
    if v_player->>'id' = p_player_id then
      v_current := coalesce(nullif(v_player->>'currentElo','')::numeric, 1000);
      v_next := greatest(500, v_current + p_delta);
      v_player := jsonb_set(v_player, '{currentElo}', to_jsonb(v_next), true);

      if p_raise_peak then
        v_peak := coalesce(nullif(v_player->>'peakElo','')::numeric, v_next);
        v_player := jsonb_set(v_player, '{peakElo}', to_jsonb(greatest(v_peak, v_next)), true);
      end if;

      v_history := coalesce(v_player->'eloHistory', '[]'::jsonb);
      if jsonb_typeof(v_history) <> 'array' then
        v_history := '[]'::jsonb;
      end if;

      if jsonb_array_length(v_history) = 0 then
        v_match_no := coalesce(nullif(v_player->>'totalMatches','')::integer, 0);
        v_history := jsonb_build_array(
          jsonb_build_object('match', v_match_no, 'elo', v_next)
        );
      else
        v_last_index := jsonb_array_length(v_history) - 1;
        v_history := jsonb_set(
          v_history,
          array[v_last_index::text, 'elo'],
          to_jsonb(v_next),
          true
        );
      end if;

      v_player := jsonb_set(v_player, '{eloHistory}', v_history, true);
    end if;

    v_result := v_result || jsonb_build_array(v_player);
  end loop;

  return v_result;
end;
$$;

do $$
declare
  v_players jsonb;
  v_player_id text;
begin
  select players into v_players
  from public.app_state
  where id = 'main'
  for update;

  if v_players is null then
    return;
  end if;

  for v_player_id in
    select value->>'id'
    from jsonb_array_elements(v_players)
    where coalesce(value->>'id','') <> ''
  loop
    v_players := public.adjust_player_elo_json(v_players, v_player_id, 0, false);
  end loop;

  update public.app_state
  set
    players = v_players,
    version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = now()
  where id = 'main';
end;
$$;
