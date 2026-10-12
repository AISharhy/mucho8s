begin;
do $$
declare ids text[]; a uuid; t jsonb; stamp timestamptz; room jsonb; mid uuid; fixture text; winner text; round_index int; i int; report_id uuid; old_matches jsonb; teams jsonb:='[]'; roster jsonb;
begin
 select matches into old_matches from app_state where id='main';
 select array_agg(player_id),min(id::text)::uuid into ids,a from(select id,player_id from player_accounts p where player_id is not null and exists(select 1 from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=p.player_id) and not exists(select 1 from live_team_matches l where l.status='live' and(l.team_a||l.team_b)?p.player_id) order by id limit 8)t;
 if cardinality(ids)<>8 then raise exception 'Eight idle players required';end if;
 for i in 0..3 loop roster:=jsonb_build_array(jsonb_build_object('id',ids[i*2+1],'name','Bot fixture'),jsonb_build_object('id',ids[i*2+2],'name','Bot fixture'));teams:=teams||jsonb_build_array(jsonb_build_object('id','qa-team-'||i,'name','QA Team '||i,'roster',roster));end loop;
 t:=jsonb_build_object('name','QA_ROLLBACK_CUP','game','BO7','format','2v2','mode','Hardpoint','bestOf',3,'finalBestOf',3,'status','live','teams',teams,'switcheroo',jsonb_build_object('publishedAt','qa-fixture'),'bracket',jsonb_build_array(jsonb_build_array(jsonb_build_object('id','r0m0','a',teams->0,'b',teams->1,'winner',null),jsonb_build_object('id','r0m1','a',teams->2,'b',teams->3,'winner',null)),jsonb_build_array(jsonb_build_object('id','r1m0','a',null,'b',null,'winner',null))));
 update tourney_state set state=t,status='live',updated_at=now() where id='current';
 for i in 0..2 loop
  fixture:=case when i<2 then 'r0m'||i else 'r1m0' end;
  select updated_at into stamp from tourney_state where id='current';
  room:=tourney_open_room(fixture,'["Den","Frequency","Gridlock"]',a,stamp);mid:=(room->'liveMatch'->>'id')::uuid;
  if mid is null then raise exception 'Tournament room missing';end if;
  -- Opening again must return the same room, never duplicate the fixture.
  select updated_at into stamp from tourney_state where id='current';
  if(tourney_open_room(fixture,'["Den","Frequency","Gridlock"]',a,stamp)->'liveMatch'->>'id')::uuid<>mid then raise exception 'Duplicate fixture room';end if;
  insert into team_match_reports(match_id,team_a,team_b,winner,score_a,score_b,game,mode,maps,pairings,captain_a_player_id,captain_b_player_id,reporter_player_id,status)
  select match_id,team_a,team_b,'A',2,0,game,mode,maps,pairings,team_a->>0,team_b->>0,team_a->>0,'pending' from live_team_matches where id=mid returning id into report_id;
  if(select status from live_team_matches where id=mid)<>'live' then raise exception 'Pending report closed fixture';end if;
  update team_match_reports set status='completed',verified_at=now() where id=report_id;
 end loop;
 select state into t from tourney_state where id='current';
 if t->>'status'<>'completed' or t->'champion'->>'id'<>'qa-team-0' or t->'bracket'->1->0->>'winner'<>'a' then raise exception 'Final did not award champion';end if;
 if (select matches from app_state where id='main') is distinct from old_matches then raise exception 'SQL lifecycle test changed real history';end if;
end;$$;
rollback;
