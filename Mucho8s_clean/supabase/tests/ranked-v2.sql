-- Transactional integration test: all fixtures and mutations are rolled back.
begin;
do $$
declare a uuid[]; ids text[]; l uuid; r ranked_lobbies%rowtype; s jsonb; i int; p text; caller uuid; rejected boolean; before_matches jsonb;
begin
 select matches into before_matches from app_state where id='main';
 select array_agg(id),array_agg(player_id) into a,ids from (select id,player_id from player_accounts p where player_id is not null and exists(select 1 from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=p.player_id) and not exists(select 1 from ranked_queue q where q.account_id=p.id) and not exists(select 1 from ranked_lobby_players m join ranked_lobbies l on l.id=m.lobby_id where m.account_id=p.id and l.status not in ('completed','cancelled')) order by id limit 8) t;
 if cardinality(a)<>8 then raise exception 'Need eight idle linked accounts';end if;
 for i in 1..8 loop insert into ranked_queue(account_id,player_id,mode) values(a[i],ids[i],'snd');end loop;
 l:=ranked_find_match('snd');select * into r from ranked_lobbies where id=l;
 if r.status<>'draft' or cardinality(r.team_a)<>1 or cardinality(r.team_b)<>1 or extract(epoch from r.preparation_deadline-r.preparation_started_at)<>120 then raise exception 'Assembly/timer failure';end if;
 -- Unauthorized captain action must be rejected.
 select account_id into caller from ranked_lobby_players where lobby_id=l and player_id<>r.team_a[1] limit 1;
 rejected:=false;
 begin perform ranked_v2_action(caller,'pick',jsonb_build_object('playerId',ids[8]));exception when others then rejected:=true;end;
 if not rejected then raise exception 'Unauthorized pick accepted';end if;
 for i in 0..5 loop
  select * into r from ranked_lobbies where id=l;
  p:=(select v from unnest(r.player_ids) v where not v=any(r.team_a||r.team_b) limit 1);
  select account_id into caller from ranked_lobby_players where lobby_id=l and player_id=(case when (array['A','B','B','A','A','B'])[i+1]='A' then r.team_a[1] else r.team_b[1] end);
  s:=ranked_v2_action(caller,'pick',jsonb_build_object('playerId',p));
 end loop;
 select * into r from ranked_lobbies where id=l;
 if r.status<>'vote' or cardinality(r.team_a)<>4 or cardinality(r.team_b)<>4 or r.preparation_deadline<> (s->'lobby'->>'preparation_deadline')::timestamptz then raise exception 'Snake draft failure';end if;
 for i in 1..8 loop perform ranked_v2_action(a[i],'vote-map',jsonb_build_object('map','Raid'));end loop;
 select * into r from ranked_lobbies where id=l;
 if r.status<>'lobby' or r.map_name<>'Raid' or r.lobby_code is not null then raise exception 'Map vote/code isolation failure';end if;
 select account_id into caller from ranked_lobby_players where lobby_id=l and player_id=r.host_player_id;
 perform ranked_v2_action(caller,'set-lobby-code',jsonb_build_object('code','TEST_CODE'));
 for i in 1..8 loop perform ranked_v2_action(a[i],'ready','{}');end loop;
 select * into r from ranked_lobbies where id=l;
 if r.status<>'live' or not exists(select 1 from live_team_matches where id=l and status='live') then raise exception 'Ready check/shared room failure';end if;
 perform ranked_v2_action(a[1],'report',jsonb_build_object('winner','A'));
 select * into r from ranked_lobbies where id=l;
 if r.status<>'pending' or not exists(select 1 from live_team_matches where id=l and status='live') then raise exception 'Report prematurely closed room';end if;
 if (select matches from app_state where id='main') is distinct from before_matches then raise exception 'Pending report changed Elo/history';end if;
 rejected:=false;
 begin perform ranked_v2_action(a[2],'report',jsonb_build_object('winner','B'));exception when others then rejected:=true;end;
 if not rejected then raise exception 'Duplicate report accepted';end if;
 update team_match_reports set status='disputed' where id=r.report_id;
 if (select status from ranked_lobbies where id=l)<>'disputed' then raise exception 'Dispute not propagated';end if;
 -- Do not finalize any real result; only check lifecycle triggers on rolled back fixtures.
 update team_match_reports set status='completed',verified_at=now() where id=r.report_id;
 if (select status from ranked_lobbies where id=l)<>'completed' or (select status from live_team_matches where id=l)<>'closed' then raise exception 'Completion not propagated';end if;
end;$$;
rollback;
