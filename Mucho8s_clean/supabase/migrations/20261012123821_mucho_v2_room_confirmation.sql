create or replace function public.sync_ranked_report_status() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 update ranked_lobbies set status=case new.status when 'completed' then 'completed' when 'cancelled' then 'cancelled' when 'disputed' then 'disputed' else 'pending' end,
 result_confirmed_at=case when new.status='completed' then new.verified_at else null end,completed_at=case when new.status='completed' then now() else null end
 where id::text=new.match_id;
 if new.status='cancelled' then update live_team_matches set status='cancelled',closed_at=now() where match_id=new.match_id and status='live';end if;
 if new.status='completed' then update live_team_matches set status='closed',closed_at=now() where match_id=new.match_id and status='live';end if;
 return new;
end;$$;
create trigger sync_ranked_report_status after update of status on public.team_match_reports for each row execute function public.sync_ranked_report_status();
alter table public.live_team_matches add column if not exists lobby_code text;
alter table public.live_team_matches add column if not exists ready_player_ids jsonb not null default '[]';

-- RPCs are private service operations. Verified Edge Functions supply the account ID.
revoke all on function public.ranked_v2_action(uuid,text,jsonb), public.ranked_tick(uuid), public.ranked_find_match(text), public.ranked_map_pool(text), public.sync_ranked_report_status() from public,anon,authenticated;
grant execute on function public.ranked_v2_action(uuid,text,jsonb), public.ranked_tick(uuid), public.ranked_find_match(text), public.ranked_map_pool(text), public.sync_ranked_report_status() to service_role;
-- Retire the separate Elo ledger path; all Ranked results use team_match_reports.
revoke all on function public.ranked_finalize(uuid), public.ranked_cast_map_vote(uuid,uuid,text),public.ranked_set_lobby_code(uuid,uuid,text) from public,anon,authenticated,service_role;
create or replace function public.live_room_action(p_id uuid,p_player_id text,p_action text,p_code text default '') returns jsonb language plpgsql security invoker set search_path=public as $$
declare l live_team_matches%rowtype;
begin
 select * into l from live_team_matches where id=p_id for update;
 if not found or l.status<>'live' then raise exception 'Room is not Live';end if;
 if not (l.team_a||l.team_b) ? p_player_id then raise exception 'Only participants can change this room';end if;
 if exists(select 1 from ranked_lobbies where id=p_id) then raise exception 'Use Ranked room controls';end if;
 if exists(select 1 from team_match_reports where match_id=l.match_id) then raise exception 'Result awaiting verification';end if;
 if p_action='set-room-code' then
  if p_player_id<>l.captain_player_id then raise exception 'Only captain can publish the code';end if;
  if upper(trim(p_code))!~'^[A-Z0-9_-]{3,32}$' then raise exception 'Invalid lobby code';end if;
  update live_team_matches set lobby_code=upper(trim(p_code)) where id=p_id;
 elsif p_action='set-room-ready' then
  if l.lobby_code is null then raise exception 'Wait for the lobby code';end if;
  if not l.ready_player_ids ? p_player_id then update live_team_matches set ready_player_ids=ready_player_ids||jsonb_build_array(p_player_id) where id=p_id;end if;
 else raise exception 'Invalid action';end if;
 return (select to_jsonb(t) from live_team_matches t where id=p_id);
end;$$;
revoke all on function public.live_room_action(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.live_room_action(uuid,text,text,text) to service_role;
