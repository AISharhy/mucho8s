create or replace function public.tourney_open_room(p_fixture_id text,p_maps jsonb,p_account_id uuid,p_updated_at timestamptz) returns jsonb language plpgsql security invoker set search_path=public as $$
declare tr tourney_state%rowtype; fixture jsonb; ri int; mi int; size int; a jsonb; b jsonb; pairs jsonb:='[]'; mid uuid; tkey text; i int; bo int;
begin
 select * into tr from tourney_state where id='current' for update;
 if not found or tr.updated_at is distinct from p_updated_at then raise exception 'Tournament changed; refresh and retry';end if;
 if tr.status not in ('live','ready') then raise exception 'Tournament is not Live';end if;
 for r_iter in 0..jsonb_array_length(coalesce(tr.state->'bracket','[]'))-1 loop
  for m_iter in 0..jsonb_array_length(tr.state->'bracket'->r_iter)-1 loop
   fixture:=tr.state->'bracket'->r_iter->m_iter;
   if fixture->>'id'=p_fixture_id then ri:=r_iter;mi:=m_iter;exit;end if;
  end loop;
  if fixture->>'id'=p_fixture_id then exit;end if;
 end loop;
 if fixture is null or fixture->>'id' is distinct from p_fixture_id or fixture->'a'='null'::jsonb or fixture->'b'='null'::jsonb or fixture->>'winner' is not null then raise exception 'Fixture unavailable';end if;
 tkey:=coalesce(tr.state->>'name','')||':'||coalesce(tr.state->'switcheroo'->>'publishedAt','');
 select id into mid from live_team_matches where tourney_key=tkey and tourney_fixture_id=p_fixture_id;
 if mid is not null then return jsonb_build_object('ok',true,'liveMatch',(select to_jsonb(l) from live_team_matches l where id=mid));end if;
 select jsonb_agg(x->>'id' order by ord) into a from jsonb_array_elements(fixture->'a'->'roster') with ordinality e(x,ord);
 select jsonb_agg(x->>'id' order by ord) into b from jsonb_array_elements(fixture->'b'->'roster') with ordinality e(x,ord);
 size:=split_part(coalesce(tr.state->>'format','4v4'),'v',1)::int;
 if size not between 2 and 4 or jsonb_array_length(a) is distinct from size or jsonb_array_length(b) is distinct from size then raise exception 'Tournament room requires complete 2v2, 3v3 or 4v4 rosters';end if;
 if (select count(distinct x) from jsonb_array_elements_text(a||b) x)<>size*2 then raise exception 'Invalid duplicate tournament roster';end if;
 if exists(select 1 from jsonb_array_elements_text(a||b) x where not exists(select 1 from app_state s,jsonb_array_elements(s.players) p where s.id='main' and p->>'id'=x)) then raise exception 'Roster player missing';end if;
 if exists(select 1 from live_team_matches l,jsonb_array_elements_text(a||b) x where l.status='live' and(l.team_a||l.team_b)?x) then raise exception 'Player already has a Live room';end if;
 bo:=case when ri=jsonb_array_length(tr.state->'bracket')-1 then (tr.state->>'finalBestOf')::int else (tr.state->>'bestOf')::int end;
 if jsonb_array_length(p_maps) is distinct from bo then raise exception 'Invalid mapset';end if;
 for i in 0..size-1 loop pairs:=pairs||jsonb_build_array(jsonb_build_object('playerAId',a->>i,'playerBId',b->>i,'amount',0,'platform','free'));end loop;
 insert into live_team_matches(match_id,team_a,team_b,game,mode,format,maps,pairings,captain_player_id,creator_account_id,club_a_id,club_b_id,tourney_fixture_id,tourney_key,tourney_name,tourney_final)
 values(gen_random_uuid()::text,a,b,tr.state->>'game',tr.state->>'mode',tr.state->>'format',p_maps,pairs,a->>0,p_account_id,nullif(fixture->'a'->>'clubId','')::uuid,nullif(fixture->'b'->>'clubId','')::uuid,p_fixture_id,tkey,tr.state->>'name',ri=jsonb_array_length(tr.state->'bracket')-1) returning id into mid;
 tr.state:=jsonb_set(tr.state,array['bracket',ri::text,mi::text,'liveMatchId'],to_jsonb(mid::text));
 update tourney_state set state=tr.state,updated_at=now() where id='current';
 return jsonb_build_object('ok',true,'liveMatch',(select to_jsonb(l) from live_team_matches l where id=mid));
end;$$;
create or replace function public.advance_verified_tourney_room() returns trigger language plpgsql security invoker set search_path=public as $$
declare l live_team_matches%rowtype; tr tourney_state%rowtype; fixture jsonb; won jsonb; ri int; mi int; next_slot text; needed int;
begin
 if new.status<>'completed' or old.status='completed' then return new;end if;
 select * into l from live_team_matches where match_id=new.match_id;
 if l.tourney_fixture_id is null then return new;end if;
 select * into tr from tourney_state where id='current' for update;
 if not found or l.tourney_key is distinct from coalesce(tr.state->>'name','')||':'||coalesce(tr.state->'switcheroo'->>'publishedAt','') then raise exception 'Tournament identity changed';end if;
 for r_iter in 0..jsonb_array_length(tr.state->'bracket')-1 loop
  for m_iter in 0..jsonb_array_length(tr.state->'bracket'->r_iter)-1 loop
   fixture:=tr.state->'bracket'->r_iter->m_iter;if fixture->>'id'=l.tourney_fixture_id then ri:=r_iter;mi:=m_iter;exit;end if;
  end loop;if fixture->>'id'=l.tourney_fixture_id then exit;end if;
 end loop;
 if fixture->>'id' is distinct from l.tourney_fixture_id then raise exception 'Fixture missing';end if;
 if fixture->>'winner' is not null then return new;end if;
 needed:=ceil(jsonb_array_length(l.maps)/2.0)::int;
 if greatest(new.score_a,new.score_b)<>needed or least(new.score_a,new.score_b)>=needed then raise exception 'Invalid tournament series score';end if;
 fixture:=fixture||jsonb_build_object('winner',case when new.winner='A' then 'a' else 'b' end,'scoreA',new.score_a,'scoreB',new.score_b,'verifiedAt',new.verified_at);
 won:=case when new.winner='A' then fixture->'a' else fixture->'b' end;
 tr.state:=jsonb_set(tr.state,array['bracket',ri::text,mi::text],fixture);
 if ri=jsonb_array_length(tr.state->'bracket')-1 then
  tr.state:=tr.state||jsonb_build_object('champion',won,'status','completed');tr.status:='completed';
 else
  next_slot:=case when mi%2=0 then 'a' else 'b' end;
  tr.state:=jsonb_set(tr.state,array['bracket',(ri+1)::text,(mi/2)::text,next_slot],won);
 end if;
 update tourney_state set state=tr.state,status=tr.status,updated_at=now() where id='current';
 return new;
end;$$;

revoke all on function public.tourney_open_room(text,jsonb,uuid,timestamptz),public.advance_verified_tourney_room() from public,anon,authenticated;
grant execute on function public.tourney_open_room(text,jsonb,uuid,timestamptz),public.advance_verified_tourney_room() to service_role;

