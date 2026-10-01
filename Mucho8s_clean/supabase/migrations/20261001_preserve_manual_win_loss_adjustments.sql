-- Preserve Admin W/L corrections when the progressive Elo trigger replays match history.
-- Manual adjustments are stored on each player and used as the baseline before
-- verified Mucho8s matches are replayed.

do $$
declare
  v_definition text;
  v_guard_old text := E'  if new.id <> ''main'' then\n    return new;\n  end if;';
  v_guard_new text := E'  if new.id <> ''main'' then\n    return new;\n  end if;\n\n  -- Player-only Admin edits must not replay match-derived statistics.\n  if new.matches is not distinct from old.matches then\n    return new;\n  end if;';
  v_insert_old text := E'    insert into tmp_m8_v7_state (player_id, calc_elo, calc_peak)\n    values (v_player_id, greatest(500, v_baseline), greatest(500, v_baseline))\n    on conflict (player_id) do nothing;';
  v_insert_new text := E'    insert into tmp_m8_v7_state (\n      player_id, calc_elo, calc_peak, total_matches, wins, losses\n    )\n    values (\n      v_player_id,\n      greatest(500, v_baseline),\n      greatest(500, v_baseline),\n      coalesce((v_player->''manualStatAdjustments''->>''wins'')::integer, 0)\n        + coalesce((v_player->''manualStatAdjustments''->>''losses'')::integer, 0),\n      coalesce((v_player->''manualStatAdjustments''->>''wins'')::integer, 0),\n      coalesce((v_player->''manualStatAdjustments''->>''losses'')::integer, 0)\n    )\n    on conflict (player_id) do nothing;';
begin
  select pg_get_functiondef('public.enforce_mucho8s_progressive_elo_v7()'::regprocedure)
    into v_definition;

  if position(v_guard_new in v_definition) = 0 then
    if position(v_guard_old in v_definition) = 0 then
      raise exception 'Could not locate progressive Elo trigger guard';
    end if;
    v_definition := replace(v_definition, v_guard_old, v_guard_new);
  end if;

  if position(v_insert_new in v_definition) = 0 then
    if position(v_insert_old in v_definition) = 0 then
      raise exception 'Could not locate progressive Elo player baseline insert';
    end if;
    v_definition := replace(v_definition, v_insert_old, v_insert_new);
  end if;

  execute v_definition;
end;
$$;
