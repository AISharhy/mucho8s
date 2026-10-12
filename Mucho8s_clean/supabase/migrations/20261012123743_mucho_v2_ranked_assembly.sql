create or replace function public.ranked_map_pool(p_mode text) returns text[] language sql immutable set search_path=public as $$
select case when p_mode='snd' then array['Den','Frequency','Gridlock','Raid','Scar','Hacienda','Fringe'] else array['Colossus','Den','Gridlock','Frequency','Scar','Hacienda'] end;
$$;

create or replace function public.ranked_find_match(p_mode text) returns uuid language plpgsql security invoker set search_path=public as $$
declare r record; ids text[]:='{}'; accounts uuid[]:='{}'; captains text[]; result_id uuid; i int;
begin
 if p_mode not in ('hp','snd') then raise exception 'Invalid playlist'; end if;
 perform pg_advisory_xact_lock(hashtext('mucho-ranked-queue'));
 -- Abandoned entries cannot strand the queue or join a match later.
 delete from ranked_queue where last_seen_at < now()-interval '45 seconds';
 for r in select q.* from ranked_queue q where q.mode=p_mode
 and not exists(select 1 from ranked_lobby_players m join ranked_lobbies l on l.id=m.lobby_id where m.player_id=q.player_id and l.status not in ('completed','cancelled'))
 order by q.joined_at limit 8 for update of q skip locked loop
  ids:=array_append(ids,r.player_id); accounts:=array_append(accounts,r.account_id);
 end loop;
 if cardinality(ids)<>8 then return null;end if;
 -- The two highest rated participants captain opposing teams; stable ID breaks ties.
 select array_agg(pid order by rating desc,pid) into captains from
 (select x->>'id' pid,coalesce((x->>'currentElo')::int,1000) rating from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=any(ids)) p;
 if cardinality(captains)<>8 then raise exception 'Roster missing';end if;
 insert into ranked_lobbies(mode,status,team_a,team_b,player_ids,preparation_started_at,preparation_deadline,phase_deadline,host_player_id,map_name)
 values(p_mode,'draft',array[captains[1]],array[captains[2]],ids,now(),now()+interval '120 seconds',now()+interval '30 seconds',captains[1],null) returning id into result_id;
 for i in 1..8 loop insert into ranked_lobby_players(lobby_id,account_id,player_id) values(result_id,accounts[i],ids[i]);end loop;
 delete from ranked_queue where account_id=any(accounts);
 return result_id;
end;$$;

create or replace function public.ranked_tick(p_lobby_id uuid) returns void language plpgsql security invoker set search_path=public as $$
declare l ranked_lobbies%rowtype; side text; picked text; chosen text; i int; a_sum int; b_sum int; candidates text[];
begin
 select * into l from ranked_lobbies where id=p_lobby_id for update;
 if not found or l.status in ('completed','cancelled','pending','disputed','live') then return;end if;
 if now()>=l.preparation_deadline then
  update ranked_lobbies set status='cancelled',cancellation_reason='Preparazione scaduta: codice lobby o Ready Check incompleto' where id=l.id;return;
 end if;
 if l.status='draft' and (now()>=l.phase_deadline or l.draft_pick=6) then
  while l.draft_pick<6 loop
   side:=(array['A','B','B','A','A','B'])[l.draft_pick+1];
   select coalesce(sum((x->>'currentElo')::int) filter(where x->>'id'=any(l.team_a)),0),coalesce(sum((x->>'currentElo')::int) filter(where x->>'id'=any(l.team_b)),0) into a_sum,b_sum from app_state s,jsonb_array_elements(s.players) x where s.id='main';
   select x->>'id' into picked from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=any(l.player_ids) and not(x->>'id'=any(l.team_a||l.team_b))
    order by abs((case when side='A' then a_sum-b_sum else b_sum-a_sum end)+coalesce((x->>'currentElo')::int,1000)),x->>'id' limit 1;
   if side='A' then l.team_a:=array_append(l.team_a,picked);else l.team_b:=array_append(l.team_b,picked);end if;
   l.draft_pick:=l.draft_pick+1;
  end loop;
  -- Polling delays never add time. Early completion starts voting immediately.
  l.phase_deadline:=least(now(),l.phase_deadline)+interval '15 seconds';l.status:='vote';
  update ranked_lobbies set status=l.status,phase_deadline=l.phase_deadline,team_a=l.team_a,team_b=l.team_b,draft_pick=6 where id=l.id;
 end if;
 if l.status='vote' and (now()>=l.phase_deadline or (select count(*) from ranked_map_votes where lobby_id=l.id)=8) then
  select map_name into chosen from ranked_map_votes where lobby_id=l.id group by map_name order by count(*) desc,map_name limit 1;
  chosen:=coalesce(chosen,(ranked_map_pool(l.mode))[1]);
  update ranked_lobbies set status='lobby',map_name=chosen,phase_deadline=preparation_deadline where id=l.id;l.status:='lobby';
 end if;
 if l.status='lobby' and not l.host_changed and now()>l.preparation_started_at+interval '75 seconds' and
 not exists(select 1 from ranked_lobby_players where lobby_id=l.id and player_id=l.host_player_id and last_seen_at>now()-interval '20 seconds') then
  select player_id into chosen from ranked_lobby_players where lobby_id=l.id and player_id<>l.host_player_id and last_seen_at>now()-interval '20 seconds'
  order by case when player_id=l.team_b[1] then 0 else 1 end,player_id limit 1;
  if chosen is not null then update ranked_lobbies set host_player_id=chosen,host_changed=true where id=l.id;end if;
 end if;
end;$$;

