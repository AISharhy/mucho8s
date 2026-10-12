create or replace function public.ranked_v2_action(p_account_id uuid,p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare pid text; l ranked_lobbies%rowtype; mode_value text; side text; picked text; code text; rid uuid; v_winner text; report_row team_match_reports%rowtype; season int; my_membership jsonb;
begin
 select player_id into pid from player_accounts where id=p_account_id;
 if pid is null or not exists(select 1 from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=pid) then raise exception 'Approved linked player required';end if;
 -- Serialize all actions by account, preventing overlapping queue joins.
 perform pg_advisory_xact_lock(hashtext('ranked-account-'||p_account_id::text));
 update ranked_queue set last_seen_at=now() where account_id=p_account_id;
 update ranked_lobby_players set last_seen_at=now() where account_id=p_account_id;
 select r.* into l from ranked_lobbies r join ranked_lobby_players m on m.lobby_id=r.id where m.account_id=p_account_id and r.status not in ('completed','cancelled') order by r.created_at desc limit 1 for update of r;
 if l.id is not null then perform ranked_tick(l.id);select * into l from ranked_lobbies where id=l.id;end if;
 if p_action not in ('join','leave','status') and (l.id is null or l.status in ('completed','cancelled')) then raise exception 'No active lobby';end if;
 if p_action='join' then
  if l.id is not null and l.status not in ('completed','cancelled') then raise exception 'Finish your current lobby first';end if;
  mode_value:=coalesce(p_payload->>'mode','hp');if mode_value not in ('hp','snd') then raise exception 'Invalid playlist';end if;
  insert into ranked_queue(account_id,player_id,mode) values(p_account_id,pid,mode_value) on conflict(account_id) do update set last_seen_at=now();
 elsif p_action='leave' then delete from ranked_queue where account_id=p_account_id;
 elsif p_action='pick' then
  if l.status<>'draft' then raise exception 'Draft inactive';end if;
  side:=(array['A','B','B','A','A','B'])[l.draft_pick+1];
  if pid<>(case when side='A' then l.team_a[1] else l.team_b[1] end) then raise exception 'Wait for your captain turn';end if;
  picked:=p_payload->>'playerId';
  if picked is null or not picked=any(l.player_ids) or picked=any(l.team_a||l.team_b) then raise exception 'Invalid pick';end if;
  update ranked_lobbies set team_a=case when side='A' then array_append(team_a,picked) else team_a end,team_b=case when side='B' then array_append(team_b,picked) else team_b end,draft_pick=draft_pick+1 where id=l.id;
 elsif p_action='vote-map' then
  if l.status<>'vote' then raise exception 'Voting inactive';end if;
  if not coalesce((p_payload->>'map')=any(ranked_map_pool(l.mode)),false) then raise exception 'Invalid map';end if;
  insert into ranked_map_votes(lobby_id,account_id,map_name) values(l.id,p_account_id,p_payload->>'map') on conflict(lobby_id,account_id) do nothing;
 elsif p_action='set-lobby-code' then
  if l.status<>'lobby' or pid<>l.host_player_id then raise exception 'Only the designated host can publish this code';end if;
  code:=upper(trim(p_payload->>'code'));if code is null or code!~'^[A-Z0-9_-]{3,32}$' then raise exception 'Invalid lobby code';end if;
  update ranked_lobbies set lobby_code=code,lobby_code_updated_at=now(),status='ready' where id=l.id;
 elsif p_action='take-host' then
  if l.status<>'lobby' or pid<>l.team_b[1] or now()<l.preparation_started_at+interval '75 seconds' then raise exception 'Host handoff is not available';end if;
  update ranked_lobbies set host_player_id=pid,host_changed=true where id=l.id;
 elsif p_action='ready' then
  if l.status<>'ready' then raise exception 'Ready check inactive';end if;
  update ranked_lobby_players set ready=true where lobby_id=l.id and account_id=p_account_id;
  if (select count(*) from ranked_lobby_players where lobby_id=l.id and ready)=8 then
   update ranked_lobbies set status='live' where id=l.id;
   insert into live_team_matches(id,match_id,team_a,team_b,game,mode,format,maps,captain_player_id,creator_account_id,status,lobby_code)
   values(l.id,l.id::text,to_jsonb(l.team_a),to_jsonb(l.team_b),'BO7',case when l.mode='snd' then 'Search & Destroy' else 'Hardpoint' end,'4v4',jsonb_build_array(l.map_name),l.host_player_id,p_account_id,'live',l.lobby_code) on conflict(id) do nothing;
  end if;
 elsif p_action='report' then
  if l.status<>'live' then raise exception 'A report already exists or match is not Live';end if;
  v_winner:=p_payload->>'winner';if v_winner is null or v_winner not in ('A','B') then raise exception 'Invalid winner';end if;
  select season_number into season from competition_config where id='main';
  insert into team_match_reports(match_id,team_a,team_b,winner,score_a,score_b,game,mode,map,maps,map_results,pairings,season_number,captain_a_player_id,captain_b_player_id,reporter_account_id,reporter_player_id,status)
  values(l.id::text,to_jsonb(l.team_a),to_jsonb(l.team_b),v_winner,case when v_winner='A' then 1 else 0 end,case when v_winner='B' then 1 else 0 end,'BO7',case when l.mode='snd' then 'Search & Destroy' else 'Hardpoint' end,l.map_name,jsonb_build_array(l.map_name),jsonb_build_array(jsonb_build_object('map',l.map_name,'winner',v_winner)),'[]',coalesce(season,1),l.team_a[1],l.team_b[1],p_account_id,pid,'pending') returning id into rid;
  update ranked_lobbies set status='pending',report_id=rid,reported_winner=v_winner where id=l.id;
 elsif p_action not in ('status','join','leave') then raise exception 'Unknown action';end if;
 if l.id is not null then perform ranked_tick(l.id);end if;
 select mode into mode_value from ranked_queue where account_id=p_account_id;
 if mode_value is not null then perform ranked_find_match(mode_value);end if;
 select r.* into l from ranked_lobbies r join ranked_lobby_players m on m.lobby_id=r.id where m.account_id=p_account_id and r.status not in ('completed','cancelled') order by r.created_at desc limit 1;
 if l.id is not null then perform ranked_tick(l.id);select * into l from ranked_lobbies where id=l.id;end if;
 return jsonb_build_object('ok',true,'serverNow',now(),'playerId',pid,'queue',(select to_jsonb(q) from ranked_queue q where account_id=p_account_id),
 'queuedPlayers',(select count(*) from ranked_queue where mode=coalesce(mode_value,l.mode,'hp') and last_seen_at>now()-interval '45 seconds'),
 'lobby',case when l.id is null or l.status='cancelled' then null else to_jsonb(l) end,
 'cancellationReason',case when l.status='cancelled' then l.cancellation_reason else null end,
 'member',(select to_jsonb(m) from ranked_lobby_players m where lobby_id=l.id and account_id=p_account_id),
 'players',coalesce((select jsonb_agg(jsonb_build_object('player_id',m.player_id,'ready',m.ready,'online',m.last_seen_at>now()-interval '20 seconds')) from ranked_lobby_players m where m.lobby_id=l.id),'[]'),
 'mapVotes',coalesce((select jsonb_agg(jsonb_build_object('map_name',v.map_name)) from ranked_map_votes v where lobby_id=l.id),'[]'),
 'voted',exists(select 1 from ranked_map_votes where lobby_id=l.id and account_id=p_account_id));
end;$$;

-- Reflect opponent confirmation and admin dispute resolution from the shared report pipeline.
