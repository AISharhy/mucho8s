-- Progressive Mucho8s Elo model.
-- Base result: WIN +25 / LOSS -15.
-- MVP: every 3 consecutive wins, +5 Elo.
-- MVP denial bounty: +3 Elo to every winner when the losing team contains
-- a player who entered the match one win from an MVP (2, 5, 8...).
-- Team upset modifier uses PRE-MATCH average team Elo:
--   <100: +0 / -0
--   100-199: underdog +2 / favorite -1
--   200-299: underdog +3 / favorite -2
--   300-399: underdog +4 / favorite -3
--   400+: underdog +5 / favorite -3
-- The modifier only applies when the lower-average-Elo team wins.
-- Money pairings remain 1 EUR = +/-1 Elo through challenge_elo_events and are
-- intentionally excluded from match eloChanges to avoid double counting.
-- General Trophy level unlock rewards are now part of the same rank Elo.
-- MERDA remains a visual/stat debt only and never changes Elo.
--
-- This migration replays every stored Mucho8s match chronologically and patches
-- historical eloChanges/awards/trophy unlocks. Current player Elo is corrected
-- by the difference between old and rebuilt match deltas, preserving the already
-- applied Money Chall ledger.

create or replace function public.enforce_mucho8s_progressive_elo_v7()
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
  v_opponent_id text;

  v_team_a jsonb;
  v_team_b jsonb;
  v_winner text;
  v_won boolean;

  v_streak integer;
  v_mvp_count integer;
  v_merda_count integer;
  v_next_streak integer;
  v_total_matches integer;
  v_wins integer;
  v_losses integer;
  v_best_win_streak integer;
  v_clean_sweep_count integer;
  v_run_it_back_count integer;
  v_won_value numeric;
  v_max_won_pairing numeric;

  v_new_mvp_ids jsonb;
  v_new_merda_ids jsonb;
  v_clear_ids jsonb;
  v_stopped_ids jsonb;
  v_recipient_ids jsonb;

  v_old_delta numeric;
  v_new_delta numeric;
  v_correction numeric;
  v_changes jsonb;

  v_average_a numeric;
  v_average_b numeric;
  v_winner_average numeric;
  v_loser_average numeric;
  v_upset_difference numeric;
  v_upset_applied boolean;
  v_upset_winner_bonus integer;
  v_upset_loser_penalty integer;

  v_money numeric;
  v_money_delta numeric;

  v_rule record;
  v_value numeric;
  v_prev_level integer;
  v_new_level integer;
  v_level integer;
  v_reward integer;
  v_general_bonus integer;
  v_trophy_events jsonb;
  v_player_events jsonb;

  v_h2h_played integer;
  v_h2h_wins integer;
  v_last_result text;

  v_current numeric;
  v_next_current numeric;
  v_peak numeric;
  v_baseline numeric;
begin
  if new.id <> 'main' then
    return new;
  end if;

  create temporary table if not exists tmp_m8_v7_state (
    player_id text primary key,
    calc_elo numeric not null default 1000,
    calc_peak numeric not null default 1000,
    correction numeric not null default 0,
    streak integer not null default 0,
    mvp_count integer not null default 0,
    merda_count integer not null default 0,
    total_matches integer not null default 0,
    wins integer not null default 0,
    losses integer not null default 0,
    won_value numeric not null default 0,
    max_won_pairing numeric not null default 0,
    best_win_streak integer not null default 0,
    clean_sweep_count integer not null default 0,
    run_it_back_count integer not null default 0,
    last_general_bonus integer not null default 0
  ) on commit drop;

  create temporary table if not exists tmp_m8_v7_h2h (
    player_id text not null,
    opponent_id text not null,
    played integer not null default 0,
    wins integer not null default 0,
    last_result text,
    primary key (player_id, opponent_id)
  ) on commit drop;

  create temporary table if not exists tmp_m8_v7_trophy_levels (
    player_id text not null,
    trophy_id text not null,
    level integer not null default 0,
    primary key (player_id, trophy_id)
  ) on commit drop;

  create temporary table if not exists tmp_m8_v7_trophy_rules (
    trophy_id text primary key,
    base_goal numeric not null,
    base_reward integer not null
  ) on commit drop;

  create temporary table if not exists tmp_m8_v7_matches (
    match_id text primary key,
    rebuilt jsonb not null
  ) on commit drop;

  truncate table tmp_m8_v7_state;
  truncate table tmp_m8_v7_h2h;
  truncate table tmp_m8_v7_trophy_levels;
  truncate table tmp_m8_v7_trophy_rules;
  truncate table tmp_m8_v7_matches;

  insert into tmp_m8_v7_trophy_rules (trophy_id, base_goal, base_reward)
  values
    ('veteran', 40, 5),
    ('money-maker', 50, 5),
    ('high-roller', 20, 8),
    ('rivalry', 8, 4),
    ('nemesis', 4, 6),
    ('run-it-back', 1, 3),
    ('on-fire', 4, 6),
    ('unstoppable', 8, 10),
    ('clean-sweep', 1, 7);

  for v_player in
    select value
    from jsonb_array_elements(v_players)
  loop
    v_player_id := v_player->>'id';
    if coalesce(v_player_id, '') = '' then
      continue;
    end if;

    v_baseline := 1000;
    if jsonb_typeof(v_player->'eloHistory') = 'array'
       and jsonb_array_length(v_player->'eloHistory') > 0 then
      v_baseline := coalesce(
        nullif(v_player->'eloHistory'->0->>'elo', '')::numeric,
        1000
      );
    end if;

    insert into tmp_m8_v7_state (player_id, calc_elo, calc_peak)
    values (v_player_id, greatest(500, v_baseline), greatest(500, v_baseline))
    on conflict (player_id) do nothing;
  end loop;

  for v_match in
    select value
    from jsonb_array_elements(v_matches)
    order by
      coalesce((value->>'date')::timestamptz, 'epoch'::timestamptz) asc,
      value->>'id' asc
  loop
    v_team_a := case
      when jsonb_typeof(v_match->'teamA') = 'array' then v_match->'teamA'
      else '[]'::jsonb
    end;
    v_team_b := case
      when jsonb_typeof(v_match->'teamB') = 'array' then v_match->'teamB'
      else '[]'::jsonb
    end;
    v_winner := case when v_match->>'winner' = 'B' then 'B' else 'A' end;

    -- Preserve the real pre-match averages once they have been stamped.
    v_average_a := nullif(v_match->>'teamAverageEloA', '')::numeric;
    v_average_b := nullif(v_match->>'teamAverageEloB', '')::numeric;

    if v_average_a is null then
      select coalesce(avg(s.calc_elo), 1000)
        into v_average_a
      from jsonb_array_elements_text(v_team_a) ids(player_id)
      left join tmp_m8_v7_state s on s.player_id = ids.player_id;
    end if;

    if v_average_b is null then
      select coalesce(avg(s.calc_elo), 1000)
        into v_average_b
      from jsonb_array_elements_text(v_team_b) ids(player_id)
      left join tmp_m8_v7_state s on s.player_id = ids.player_id;
    end if;

    v_winner_average := case when v_winner = 'A' then v_average_a else v_average_b end;
    v_loser_average := case when v_winner = 'A' then v_average_b else v_average_a end;
    v_upset_difference := greatest(0, round(abs(v_average_a - v_average_b)));
    v_upset_applied := false;
    v_upset_winner_bonus := 0;
    v_upset_loser_penalty := 0;

    if v_winner_average < v_loser_average and v_upset_difference >= 100 then
      v_upset_applied := true;
      if v_upset_difference >= 400 then
        v_upset_winner_bonus := 5;
        v_upset_loser_penalty := 3;
      elsif v_upset_difference >= 300 then
        v_upset_winner_bonus := 4;
        v_upset_loser_penalty := 3;
      elsif v_upset_difference >= 200 then
        v_upset_winner_bonus := 3;
        v_upset_loser_penalty := 2;
      else
        v_upset_winner_bonus := 2;
        v_upset_loser_penalty := 1;
      end if;
    end if;

    v_new_mvp_ids := '[]'::jsonb;
    v_new_merda_ids := '[]'::jsonb;
    v_clear_ids := '[]'::jsonb;
    v_stopped_ids := '[]'::jsonb;
    v_recipient_ids := '[]'::jsonb;
    v_trophy_events := '{}'::jsonb;

    -- MVP Bounty is determined from the PRE-MATCH streak.
    for v_player_id in
      select jsonb_array_elements_text(v_team_a)
      union all
      select jsonb_array_elements_text(v_team_b)
    loop
      select streak into v_streak
      from tmp_m8_v7_state
      where player_id = v_player_id;

      if not found then
        insert into tmp_m8_v7_state(player_id, calc_elo, calc_peak)
        values (v_player_id, 1000, 1000)
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

    if jsonb_array_length(v_stopped_ids) > 0 then
      v_recipient_ids := case when v_winner = 'A' then v_team_a else v_team_b end;
    end if;

    update tmp_m8_v7_state
    set last_general_bonus = 0
    where player_id is not null;

    -- Update streak/MVP/MERDA and all General Trophy source counters.
    for v_player_id in
      select jsonb_array_elements_text(v_team_a)
      union all
      select jsonb_array_elements_text(v_team_b)
    loop
      select
        streak, mvp_count, merda_count, total_matches, wins, losses,
        won_value, max_won_pairing, best_win_streak, clean_sweep_count,
        run_it_back_count
      into
        v_streak, v_mvp_count, v_merda_count, v_total_matches, v_wins, v_losses,
        v_won_value, v_max_won_pairing, v_best_win_streak, v_clean_sweep_count,
        v_run_it_back_count
      from tmp_m8_v7_state
      where player_id = v_player_id;

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

        if v_merda_count > 0 then
          v_merda_count := v_merda_count - 1;
          v_clear_ids := v_clear_ids || jsonb_build_array(v_player_id);
        end if;

        v_wins := v_wins + 1;
        v_best_win_streak := greatest(v_best_win_streak, v_next_streak);
        if v_next_streak > 0 and mod(v_next_streak, 4) = 0 then
          v_clean_sweep_count := v_clean_sweep_count + 1;
        end if;
      else
        v_next_streak := case when v_streak < 0 then v_streak - 1 else -1 end;

        if abs(v_next_streak) >= 3 then
          v_merda_count := v_merda_count + 1;
          v_new_merda_ids := v_new_merda_ids || jsonb_build_array(v_player_id);
        end if;

        v_losses := v_losses + 1;
      end if;

      v_total_matches := v_total_matches + 1;

      select coalesce(round((pairing->>'amount')::numeric), 0)
        into v_money
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_match->'pairings') = 'array' then v_match->'pairings'
          else '[]'::jsonb
        end
      ) pairing
      where pairing->>'playerAId' = v_player_id
         or pairing->>'playerBId' = v_player_id
      limit 1;

      v_money := coalesce(v_money, 0);
      if v_won and v_money > 0 then
        v_won_value := v_won_value + v_money;
        v_max_won_pairing := greatest(v_max_won_pairing, v_money);
      end if;

      -- Head-to-head counters are updated against every player on the other team.
      for v_opponent_id in
        select jsonb_array_elements_text(
          case when v_team_a ? v_player_id then v_team_b else v_team_a end
        )
      loop
        select played, wins, last_result
          into v_h2h_played, v_h2h_wins, v_last_result
        from tmp_m8_v7_h2h
        where player_id = v_player_id
          and opponent_id = v_opponent_id;

        if not found then
          v_h2h_played := 0;
          v_h2h_wins := 0;
          v_last_result := null;
        end if;

        if v_won and v_last_result = 'L' then
          v_run_it_back_count := v_run_it_back_count + 1;
        end if;

        insert into tmp_m8_v7_h2h(player_id, opponent_id, played, wins, last_result)
        values (
          v_player_id,
          v_opponent_id,
          v_h2h_played + 1,
          v_h2h_wins + case when v_won then 1 else 0 end,
          case when v_won then 'W' else 'L' end
        )
        on conflict (player_id, opponent_id) do update set
          played = excluded.played,
          wins = excluded.wins,
          last_result = excluded.last_result;
      end loop;

      update tmp_m8_v7_state
      set
        streak = v_next_streak,
        mvp_count = greatest(0, v_mvp_count),
        merda_count = greatest(0, v_merda_count),
        total_matches = v_total_matches,
        wins = v_wins,
        losses = v_losses,
        won_value = v_won_value,
        max_won_pairing = v_max_won_pairing,
        best_win_streak = v_best_win_streak,
        clean_sweep_count = v_clean_sweep_count,
        run_it_back_count = v_run_it_back_count
      where player_id = v_player_id;

      -- Calculate every General Trophy level crossed by THIS match.
      v_general_bonus := 0;
      v_player_events := '[]'::jsonb;

      for v_rule in
        select trophy_id, base_goal, base_reward
        from tmp_m8_v7_trophy_rules
        order by trophy_id
      loop
        if v_rule.trophy_id = 'veteran' then
          v_value := v_total_matches;
        elsif v_rule.trophy_id = 'money-maker' then
          v_value := v_won_value;
        elsif v_rule.trophy_id = 'high-roller' then
          v_value := v_max_won_pairing;
        elsif v_rule.trophy_id = 'run-it-back' then
          v_value := v_run_it_back_count;
        elsif v_rule.trophy_id = 'on-fire' or v_rule.trophy_id = 'unstoppable' then
          v_value := v_best_win_streak;
        elsif v_rule.trophy_id = 'clean-sweep' then
          v_value := v_clean_sweep_count;
        elsif v_rule.trophy_id = 'rivalry' then
          select coalesce(max(played), 0) into v_value
          from tmp_m8_v7_h2h
          where player_id = v_player_id;
        elsif v_rule.trophy_id = 'nemesis' then
          select coalesce(max(wins), 0) into v_value
          from tmp_m8_v7_h2h
          where player_id = v_player_id;
        else
          v_value := 0;
        end if;

        v_new_level := least(10, floor(v_value / greatest(1, v_rule.base_goal))::integer);

        select level into v_prev_level
        from tmp_m8_v7_trophy_levels
        where player_id = v_player_id
          and trophy_id = v_rule.trophy_id;

        if not found then
          v_prev_level := 0;
        end if;

        if v_new_level > v_prev_level then
          for v_level in v_prev_level + 1..v_new_level loop
            v_reward := least(15, greatest(3, v_rule.base_reward + v_level - 1));
            v_general_bonus := v_general_bonus + v_reward;
            v_player_events := v_player_events || jsonb_build_array(
              jsonb_build_object(
                'id', v_rule.trophy_id,
                'level', v_level,
                'goal', v_rule.base_goal * v_level,
                'value', v_value,
                'reward', v_reward,
                'rewardApplied', true
              )
            );
          end loop;
        end if;

        insert into tmp_m8_v7_trophy_levels(player_id, trophy_id, level)
        values (v_player_id, v_rule.trophy_id, v_new_level)
        on conflict (player_id, trophy_id) do update set
          level = excluded.level;
      end loop;

      update tmp_m8_v7_state
      set last_general_bonus = v_general_bonus
      where player_id = v_player_id;

      if jsonb_array_length(v_player_events) > 0 then
        v_trophy_events := jsonb_set(
          v_trophy_events,
          array[v_player_id],
          v_player_events,
          true
        );
      end if;
    end loop;

    -- Rebuild the match Elo delta. Money is applied separately by the challenge ledger.
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

      select last_general_bonus into v_general_bonus
      from tmp_m8_v7_state
      where player_id = v_player_id;

      v_new_delta :=
        case when v_won then 25 else -15 end
        + case
            when v_upset_applied and v_won then v_upset_winner_bonus
            when v_upset_applied and not v_won then -v_upset_loser_penalty
            else 0
          end
        + case when v_new_mvp_ids ? v_player_id then 5 else 0 end
        + case when v_won and jsonb_array_length(v_stopped_ids) > 0 then 3 else 0 end
        + coalesce(v_general_bonus, 0);

      v_old_delta := coalesce(nullif(v_match->'eloChanges'->>v_player_id, '')::numeric, 0);
      v_correction := v_new_delta - v_old_delta;

      update tmp_m8_v7_state
      set correction = correction + v_correction
      where player_id = v_player_id;

      v_changes := jsonb_set(v_changes, array[v_player_id], to_jsonb(v_new_delta), true);

      -- Replay a shadow Elo timeline only to calculate older pre-match team strength.
      select coalesce(round((pairing->>'amount')::numeric), 0)
        into v_money
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_match->'pairings') = 'array' then v_match->'pairings'
          else '[]'::jsonb
        end
      ) pairing
      where pairing->>'playerAId' = v_player_id
         or pairing->>'playerBId' = v_player_id
      limit 1;

      v_money := coalesce(v_money, 0);
      v_money_delta := case when v_won then v_money else -v_money end;

      select calc_elo, calc_peak
        into v_current, v_peak
      from tmp_m8_v7_state
      where player_id = v_player_id;

      v_next_current := greatest(500, v_current + v_new_delta);
      v_next_current := greatest(500, v_next_current + v_money_delta);

      update tmp_m8_v7_state
      set
        calc_elo = v_next_current,
        calc_peak = greatest(v_peak, v_next_current)
      where player_id = v_player_id;
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
    v_rebuilt := jsonb_set(
      v_rebuilt,
      '{mvpBountyBonus}',
      to_jsonb(case when jsonb_array_length(v_stopped_ids) > 0 then 3 else 0 end),
      true
    );
    v_rebuilt := jsonb_set(v_rebuilt, '{mvpBountyStoppedIds}', v_stopped_ids, true);
    v_rebuilt := jsonb_set(v_rebuilt, '{mvpBountyRecipientIds}', v_recipient_ids, true);

    v_rebuilt := jsonb_set(v_rebuilt, '{teamAverageEloA}', to_jsonb(round(v_average_a)), true);
    v_rebuilt := jsonb_set(v_rebuilt, '{teamAverageEloB}', to_jsonb(round(v_average_b)), true);
    v_rebuilt := jsonb_set(v_rebuilt, '{upsetApplied}', to_jsonb(v_upset_applied), true);
    v_rebuilt := jsonb_set(v_rebuilt, '{upsetEloDifference}', to_jsonb(v_upset_difference), true);
    v_rebuilt := jsonb_set(v_rebuilt, '{upsetWinnerBonus}', to_jsonb(v_upset_winner_bonus), true);
    v_rebuilt := jsonb_set(v_rebuilt, '{upsetLoserPenalty}', to_jsonb(v_upset_loser_penalty), true);
    v_rebuilt := jsonb_set(v_rebuilt, '{trophyUnlockEvents}', v_trophy_events, true);
    v_rebuilt := jsonb_set(v_rebuilt, '{eloChanges}', v_changes, true);

    if coalesce(v_match->>'id', '') <> '' then
      insert into tmp_m8_v7_matches(match_id, rebuilt)
      values (v_match->>'id', v_rebuilt)
      on conflict (match_id) do update set rebuilt = excluded.rebuilt;
    end if;
  end loop;

  -- Apply only the MATCH-ELO correction to the already-current players.
  -- Existing Money Chall ledger deltas remain untouched.
  for v_player in
    select value
    from jsonb_array_elements(v_players)
  loop
    v_player_id := v_player->>'id';

    select
      correction, streak, mvp_count, merda_count, total_matches, wins, losses,
      calc_peak
    into
      v_correction, v_streak, v_mvp_count, v_merda_count, v_total_matches,
      v_wins, v_losses, v_peak
    from tmp_m8_v7_state
    where player_id = v_player_id;

    if found then
      v_current := coalesce(nullif(v_player->>'currentElo', '')::numeric, 1000);
      v_next_current := greatest(500, v_current + coalesce(v_correction, 0));

      v_player := jsonb_set(v_player, '{currentElo}', to_jsonb(round(v_next_current)), true);
      v_player := jsonb_set(
        v_player,
        '{peakElo}',
        to_jsonb(
          greatest(
            coalesce(nullif(v_player->>'peakElo', '')::numeric, v_next_current),
            v_next_current,
            coalesce(v_peak, v_next_current)
          )
        ),
        true
      );
      v_player := jsonb_set(v_player, '{currentStreak}', to_jsonb(v_streak), true);
      v_player := jsonb_set(v_player, '{mvpCount}', to_jsonb(greatest(0, v_mvp_count)), true);
      v_player := jsonb_set(v_player, '{merdaCount}', to_jsonb(greatest(0, v_merda_count)), true);
      v_player := jsonb_set(v_player, '{totalMatches}', to_jsonb(greatest(0, v_total_matches)), true);
      v_player := jsonb_set(v_player, '{wins}', to_jsonb(greatest(0, v_wins)), true);
      v_player := jsonb_set(v_player, '{losses}', to_jsonb(greatest(0, v_losses)), true);
    end if;

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
    from tmp_m8_v7_matches
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
drop trigger if exists trg_enforce_mucho8s_progressive_elo_v7 on public.app_state;

-- Only match changes are rebuilt here. Player-only updates (for example
-- Money Chall settlement) must not replay the team match money a second time.
create trigger trg_enforce_mucho8s_progressive_elo_v7
before update of matches on public.app_state
for each row
execute function public.enforce_mucho8s_progressive_elo_v7();

create or replace function public.sync_completed_report_awards_v7()
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
drop trigger if exists trg_sync_completed_report_awards_v7 on public.team_match_reports;

create trigger trg_sync_completed_report_awards_v7
before update on public.team_match_reports
for each row
execute function public.sync_completed_report_awards_v7();

-- Replay every stored match immediately.
update public.app_state
set
  matches = matches,
  version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
  updated_at = now()
where id = 'main';

-- Keep completed report award metadata aligned with rebuilt history.
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
