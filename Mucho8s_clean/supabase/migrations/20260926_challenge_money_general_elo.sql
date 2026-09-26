-- Money Chall results now affect the same general Elo used by the main ladder.
-- Every EUR won = +1 Elo point; the loser receives the opposite delta.
-- A ledger keeps the operation idempotent and reversible when Admin edits/deletes a verified challenge.

create table if not exists public.challenge_elo_events (
  challenge_id uuid primary key references public.player_challenges(id) on delete cascade,
  winner_player_id text not null,
  loser_player_id text not null,
  points numeric not null default 0,
  winner_delta numeric not null default 0,
  loser_delta numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.challenge_elo_events enable row level security;
revoke all on table public.challenge_elo_events from anon, authenticated;

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
    end if;

    v_result := v_result || jsonb_build_array(v_player);
  end loop;

  return v_result;
end;
$$;

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
    v_points := v_challenge.amount_cents::numeric / 100;

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

create or replace function public.remove_challenge_elo(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.challenge_elo_events%rowtype;
  v_players jsonb;
begin
  select * into v_old
  from public.challenge_elo_events
  where challenge_id = p_challenge_id
  for update;

  if v_old.challenge_id is null then
    return;
  end if;

  select players into v_players
  from public.app_state
  where id = 'main'
  for update;

  if v_players is null then
    return;
  end if;

  v_players := public.adjust_player_elo_json(v_players, v_old.winner_player_id, -v_old.winner_delta, false);
  v_players := public.adjust_player_elo_json(v_players, v_old.loser_player_id, -v_old.loser_delta, false);

  delete from public.challenge_elo_events where challenge_id = p_challenge_id;

  update public.app_state
  set
    players = v_players,
    version = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = now()
  where id = 'main';
end;
$$;

revoke all on function public.adjust_player_elo_json(jsonb, text, numeric, boolean) from public, anon, authenticated;
revoke all on function public.sync_challenge_elo(uuid) from public, anon, authenticated;
revoke all on function public.remove_challenge_elo(uuid) from public, anon, authenticated;
grant execute on function public.sync_challenge_elo(uuid) to service_role;
grant execute on function public.remove_challenge_elo(uuid) to service_role;

do $
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
end $$;
