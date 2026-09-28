-- Enforce the Mucho8s award rules at the database layer.
-- MVP: every 3 consecutive wins, +3 Elo.
-- MERDA: starts on the 3rd consecutive loss; every further loss in the same streak adds +1. Each win removes exactly 1.
-- MVP denial bounty: if the losing team contains a player who entered the match
-- one win from an MVP (2, 5, 8... consecutive wins), every winner gets +3 Elo.
-- The rebuild is idempotent and preserves the existing base result delta.

create or replace function public.enforce_mucho8s_awards_v6()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players jsonb := coalesce(new.players, '[]'::jsonb);
  v_matches jsonb := coalesce(new.matches, '[]'::jsonb);
  v_next_players jsonb := '[]'::jsonb;
  v_next_matches jsonb := '[]'::jsonb;

  v_player jsonb;
  v_match jsonb;
  v_rebuilt jsonb;
  v_player_id text;

  v_team_a jsonb;
  v_team_b jsonb;
  v_winner text;
  v_won boolean;

  v_streak integer;
  v_mvp_count integer;
  v_merda_count integer;
  v_next_streak integer;

  v_new_mvp_ids jsonb;
  v_new_merda_ids jsonb;
  v_clear_ids jsonb;
  v_stopped_ids jsonb;
  v_recipient_ids jsonb;

  v_old_mvp_ids jsonb;
  v_old_bounty numeric;
  v_new_bounty numeric;

  v_old_delta numeric;
  v_base_delta numeric;
  v_new_delta numeric;
  v_difference numeric;
  v_changes jsonb;
begin
  if new.id <> 'main' then
    return new;
  end if;

  create temporary table if not exists tmp_m8_award_state (
    player_id text primary key,
    streak integer not null default 0,
    mvp_count integer not null default 0,
    merda_count integer not null default 0
  ) on commit drop;

  create temporary table if not exists tmp_m8_rebuilt_matches (
    match_id text primary key,
    rebuilt jsonb not null
  ) on commit drop;

  truncate table tmp_m8_award_state;
  truncate table tmp_m8_rebuilt_matches;

  insert into tmp_m8_award_state (player_id)
  select value->>'id'
  from jsonb_array_elements(v_players)
  where coalesce(value->>'id', '') <> ''
  on conflict (player_id) do nothing;

  for v_match in
    select value
    from jsonb_array_elements(v_matches)
    order by
      coalesce((value->>'date')::timestamptz, 'epoch'::timestamptz) asc,
      value->>'id' asc
  loop
    v_team_a := coalesce(v_match->'teamA', '[]'::jsonb);
    v_team_b := coalesce(v_match->'teamB', '[]'::jsonb);
    v_winner := case when v_match->>'winner' = 'B' then 'B' else 'A' end;

    v_new_mvp_ids := '[]'::jsonb;
    v_new_merda_ids := '[]'::jsonb;
    v_clear_ids := '[]'::jsonb;
    v_stopped_ids := '[]'::jsonb;
    v_recipient_ids := '[]'::jsonb;

    -- Determine the bounty from the pre-match streak state.
    for v_player_id in
      select jsonb_array_elements_text(v_team_a)
      union all
      select jsonb_array_elements_text(v_team_b)
    loop
      select streak
        into v_streak
      from tmp_m8_award_state
      where player_id = v_player_id;

      if not found then
        insert into tmp_m8_award_state(player_id)
        values (v_player_id)
        on conflict (player_id) do nothing;
        v_streak := 0;
      end if;

      v_won :=
        (v_winner = 'A' and v_team_a ? v_player_id)
        or
        (v_winner = 'B' and v_team_b ? v_player_id);

      if not v_won and v_streak > 0 and mod(v_streak, 3) = 2 then
        v_stopped_ids := v_stopped_ids || jsonb_build_array(v_player_id);
      end if;
    end loop;

    v_new_bounty := case when jsonb_array_length(v_stopped_ids) > 0 then 3 else 0 end;
    if v_new_bounty > 0 then
      v_recipient_ids := case when v_winner = 'A' then v_team_a else v_team_b end;
    end if;

    -- Rebuild streaks and awards using 3-win MVP and stacking MERDA debt.
    for v_player_id in
      select jsonb_array_elements_text(v_team_a)
      union all
      select jsonb_array_elements_text(v_team_b)
    loop
      select streak, mvp_count, merda_count
        into v_streak, v_mvp_count, v_merda_count
      from tmp_m8_award_state
      where player_id = v_player_id;

      if not found then
        insert into tmp_m8_award_state(player_id)
        values (v_player_id)
        on conflict (player_id) do nothing;
        v_streak := 0;
        v_mvp_count := 0;
        v_merda_count := 0;
      end if;

      v_won :=
        (v_winner = 'A' and v_team_a ? v_player_id)
        or
        (v_winner = 'B' and v_team_b ? v_player_id);

      if v_won then
        v_next_streak := case when v_streak > 0 then v_streak + 1 else 1 end;

        if v_next_streak >= 3 and mod(v_next_streak, 3) = 0 then
          v_mvp_count := v_mvp_count + 1;
          v_new_mvp_ids := v_new_mvp_ids || jsonb_build_array(v_player_id);
        end if;

        -- One win redeems one active MERDA, regardless of the win streak.
        if v_merda_count > 0 then
          v_merda_count := v_merda_count - 1;
          v_clear_ids := v_clear_ids || jsonb_build_array(v_player_id);
        end if;
      else
        v_next_streak := case when v_streak < 0 then v_streak - 1 else -1 end;

        if abs(v_next_streak) >= 3 then
          -- LLL = x1, LLLL = x2, LLLLL = x3, and so on until the streak breaks.
          v_merda_count := v_merda_count + 1;
          v_new_merda_ids := v_new_merda_ids || jsonb_build_array(v_player_id);
        end if;
      end if;

      update tmp_m8_award_state
      set
        streak = v_next_streak,
        mvp_count = greatest(0, v_mvp_count),
        merda_count = greatest(0, v_merda_count)
      where player_id = v_player_id;
    end loop;

    -- Preserve the result-system base Elo delta, replacing only the award/bounty modifiers.
    v_old_mvp_ids := case
      when jsonb_typeof(v_match->'mvpIds') = 'array' then v_match->'mvpIds'
      when coalesce(v_match->>'mvpId', '') <> '' then jsonb_build_array(v_match->>'mvpId')
      else '[]'::jsonb
    end;
    v_old_bounty := greatest(0, coalesce(nullif(v_match->>'mvpBountyBonus', '')::numeric, 0));
    v_changes := '{}'::jsonb;

    for v_player_id in
      select jsonb_array_elements_text(v_team_a)
      union all
      select jsonb_array_elements_text(v_team_b)
    loop
      v_won :=
        (v_winner = 'A' and v_team_a ? v_player_id)
        or
        (v_winner = 'B' and v_team_b ? v_player_id);

      v_old_delta := coalesce(nullif(v_match->'eloChanges'->>v_player_id, '')::numeric, 0);

      if v_old_delta <> 0 then
        v_base_delta :=
          v_old_delta
          - case when v_old_mvp_ids ? v_player_id then 3 else 0 end
          - case when v_won then v_old_bounty else 0 end;
      else
        v_base_delta := case when v_won then 25 else -25 end;
      end if;

      v_new_delta :=
        v_base_delta
        + case when v_new_mvp_ids ? v_player_id then 3 else 0 end
        + case when v_won then v_new_bounty else 0 end;

      v_difference := v_new_delta - v_old_delta;

      if v_old_delta <> 0 and v_difference <> 0 then
        v_players := public.adjust_player_elo_json(
          v_players,
          v_player_id,
          v_difference,
          v_difference > 0
        );
      end if;

      v_changes := jsonb_set(v_changes, array[v_player_id], to_jsonb(v_new_delta), true);
    end loop;

    v_rebuilt := v_match;
    v_rebuilt := jsonb_set(v_rebuilt, '{mvpIds}', v_new_mvp_ids, true);
    v_rebuilt := jsonb_set(
      v_rebuilt,
      '{mvpId}',
      case
        when jsonb_array_length(v_new_mvp_ids) > 0 then to_jsonb(v_new_mvp_ids->>0)
        else 'null'::jsonb
      end,
      true
    );
    v_rebuilt := jsonb_set(v_rebuilt, '{merdaIds}', v_new_merda_ids, true);
    v_rebuilt := jsonb_set(
      v_rebuilt,
      '{merdaId}',
      case
        when jsonb_array_length(v_new_merda_ids) > 0 then to_jsonb(v_new_merda_ids->>0)
        else 'null'::jsonb
      end,
      true
    );
    v_rebuilt := jsonb_set(v_rebuilt, '{merdaClearedIds}', v_clear_ids, true);
    v_rebuilt := jsonb_set(v_rebuilt, '{mvpBountyBonus}', to_jsonb(v_new_bounty), true);
    v_rebuilt := jsonb_set(v_rebuilt, '{mvpBountyStoppedIds}', v_stopped_ids, true);
    v_rebuilt := jsonb_set(v_rebuilt, '{mvpBountyRecipientIds}', v_recipient_ids, true);
    v_rebuilt := jsonb_set(v_rebuilt, '{eloChanges}', v_changes, true);

    if coalesce(v_match->>'id', '') <> '' then
      insert into tmp_m8_rebuilt_matches(match_id, rebuilt)
      values (v_match->>'id', v_rebuilt)
      on conflict (match_id) do update set rebuilt = excluded.rebuilt;
    end if;
  end loop;

  -- Patch player counters/streaks after Elo corrections.
  for v_player in
    select value
    from jsonb_array_elements(v_players)
  loop
    select streak, mvp_count, merda_count
      into v_streak, v_mvp_count, v_merda_count
    from tmp_m8_award_state
    where player_id = v_player->>'id';

    if found then
      v_player := jsonb_set(v_player, '{currentStreak}', to_jsonb(v_streak), true);
      v_player := jsonb_set(v_player, '{mvpCount}', to_jsonb(greatest(0, v_mvp_count)), true);
      v_player := jsonb_set(v_player, '{merdaCount}', to_jsonb(greatest(0, v_merda_count)), true);
    end if;

    -- Gameplay roles (AR/FLEX/SMG/etc.) are no longer part of the product.
    v_player := v_player - 'role';
    v_next_players := v_next_players || jsonb_build_array(v_player);
  end loop;

  -- Preserve the original stored match ordering.
  for v_match in
    select value
    from jsonb_array_elements(v_matches)
  loop
    select rebuilt
      into v_rebuilt
    from tmp_m8_rebuilt_matches
    where match_id = v_match->>'id';

    v_next_matches := v_next_matches || jsonb_build_array(coalesce(v_rebuilt, v_match));
  end loop;

  new.players := v_next_players;
  new.matches := v_next_matches;
  return new;
end;
$$;

drop trigger if exists trg_enforce_mucho8s_awards_v4 on public.app_state;
drop trigger if exists trg_enforce_mucho8s_awards_v5 on public.app_state;
drop trigger if exists trg_enforce_mucho8s_awards_v6 on public.app_state;
create trigger trg_enforce_mucho8s_awards_v6
before update of players, matches on public.app_state
for each row
execute function public.enforce_mucho8s_awards_v6();

create or replace function public.sync_completed_report_awards_v6()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match jsonb;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  select value
    into v_match
  from public.app_state s,
       jsonb_array_elements(coalesce(s.matches, '[]'::jsonb)) value
  where s.id = 'main'
    and value->>'id' = new.match_id
  limit 1;

  if v_match is null then
    return new;
  end if;

  new.mvp_ids := case
    when jsonb_typeof(v_match->'mvpIds') = 'array' then v_match->'mvpIds'
    else '[]'::jsonb
  end;
  new.mvp_id := nullif(v_match->>'mvpId', '');
  new.merda_id := nullif(v_match->>'merdaId', '');
  return new;
end;
$$;

drop trigger if exists trg_sync_completed_report_awards_v4 on public.team_match_reports;
drop trigger if exists trg_sync_completed_report_awards_v5 on public.team_match_reports;
drop trigger if exists trg_sync_completed_report_awards_v6 on public.team_match_reports;
create trigger trg_sync_completed_report_awards_v6
before update on public.team_match_reports
for each row
execute function public.sync_completed_report_awards_v6();

-- Rebuild current history immediately using the new rule set.
update public.app_state
set
  players = players,
  matches = matches,
  version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
  updated_at = now()
where id = 'main';

-- Bring already completed report metadata in line with the rebuilt history.
update public.team_match_reports r
set
  mvp_ids = coalesce(x.match_json->'mvpIds', '[]'::jsonb),
  mvp_id = nullif(x.match_json->>'mvpId', ''),
  merda_id = nullif(x.match_json->>'merdaId', '')
from (
  select
    value->>'id' as match_id,
    value as match_json
  from public.app_state s,
       jsonb_array_elements(coalesce(s.matches, '[]'::jsonb)) value
  where s.id = 'main'
) x
where r.status = 'completed'
  and r.match_id = x.match_id;
