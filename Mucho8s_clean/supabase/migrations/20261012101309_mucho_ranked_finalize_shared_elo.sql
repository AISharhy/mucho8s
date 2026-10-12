
create or replace function public.ranked_finalize(p_lobby_id uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare
 l public.ranked_lobbies%rowtype;
 consensus text; vote_count integer;
 st public.app_state%rowtype;
 new_players jsonb:='[]'::jsonb;
 p jsonb; pid text; won boolean; elo integer; delta integer;
 avg_a float8:=0; avg_b float8:=0; expected float8;
 team_delta_a integer;team_delta_b integer;
 cur_streak integer; next_streak integer; is_mvp boolean;
 old_merda integer; new_merda integer;
 changes jsonb:='{}'::jsonb; mvp_list jsonb:='[]'::jsonb;
 new_match jsonb; n integer;
begin
 select * into l from public.ranked_lobbies where id=p_lobby_id for update;
 if not found then raise exception 'Lobby missing'; end if;
 if l.status='completed' then return false; end if;
 if l.status not in ('live','disputed') then raise exception 'Lobby not live';end if;
 select count(*),min(report) into vote_count,consensus from public.ranked_lobby_players
 where lobby_id=p_lobby_id and report is not null;
 if vote_count<>8 or consensus not in ('A','B') or
 exists(select 1 from public.ranked_lobby_players where lobby_id=p_lobby_id and report is distinct from consensus)
 then raise exception 'Unanimous reports required';end if;
 select * into st from public.app_state where id='main' for update;
 if not found then raise exception 'Missing app_state'; end if;
 select avg(greatest(500,coalesce((x->>'currentElo')::integer,1000))) into avg_a
 from jsonb_array_elements(st.players) x where x->>'id'=any(l.team_a);
 select avg(greatest(500,coalesce((x->>'currentElo')::integer,1000))) into avg_b
 from jsonb_array_elements(st.players) x where x->>'id'=any(l.team_b);
 if (select count(*) from jsonb_array_elements(st.players) x where x->>'id'=any(l.player_ids))<>8 then raise exception 'Roster missing';end if;
 -- Same Elo expectation formula as the Mucho8s frontend (K=50, scale=400, 5..45).
 expected:=1/(1+power(10,(avg_b-avg_a)/400));
 team_delta_a:=(case when consensus='A' then 1 else -1 end)*
   greatest(5,least(45,round(abs(50*((case when consensus='A' then 1 else 0 end)-expected)))::int));
 team_delta_b:=(case when consensus='B' then 1 else -1 end)*
   greatest(5,least(45,round(abs(50*((case when consensus='B' then 1 else 0 end)-(1-expected))))::int));
 for p in select value from jsonb_array_elements(st.players) loop
   pid:=p->>'id';
   if pid=any(l.player_ids) then
     won:=(consensus='A' and pid=any(l.team_a)) or (consensus='B' and pid=any(l.team_b));
     elo:=greatest(500,coalesce((p->>'currentElo')::integer,1000));
     cur_streak:=coalesce((p->>'currentStreak')::integer,0);
     next_streak:=case when won then case when cur_streak>0 then cur_streak+1 else 1 end
                     else case when cur_streak<0 then cur_streak-1 else -1 end end;
     is_mvp:=won and next_streak>=3 and mod(next_streak,3)=0;
     delta:=case when pid=any(l.team_a) then team_delta_a else team_delta_b end
       +case when is_mvp then 5 else 0 end;
     n:=coalesce((p->>'totalMatches')::integer,0)+1;
     new_merda:=coalesce((p->>'merdaCount')::integer,0);
     if not won and abs(next_streak)>=3 and mod(abs(next_streak),3)=0 then new_merda:=new_merda+1;end if;
     if is_mvp and new_merda>0 then new_merda:=new_merda-1;end if;
     elo:=greatest(500,elo+delta);
     p:=p||jsonb_build_object(
        'currentElo',elo,'peakElo',greatest(elo,coalesce((p->>'peakElo')::integer,elo)),
        'wins',coalesce((p->>'wins')::integer,0)+case when won then 1 else 0 end,
        'losses',coalesce((p->>'losses')::integer,0)+case when won then 0 else 1 end,
        'totalMatches',n,'currentStreak',next_streak,'merdaCount',new_merda,
        'mvpCount',coalesce((p->>'mvpCount')::integer,0)+case when is_mvp then 1 else 0 end,
        'eloHistory',coalesce(p->'eloHistory','[]'::jsonb)||jsonb_build_array(jsonb_build_object('match',n,'elo',elo)),
        'last10', (jsonb_build_array(case when won then 'W' else 'L' end)||coalesce(p->'last10','[]'::jsonb))->0
       );
     -- Preserve ten most recent results, including current match.
     p:=jsonb_set(p,'{last10}',(select coalesce(jsonb_agg(v),'[]'::jsonb) from
       (select value v from jsonb_array_elements(jsonb_build_array(case when won then 'W' else 'L' end)||coalesce((select z->'last10' from jsonb_array_elements(st.players) z where z->>'id'=pid limit 1),'[]'::jsonb)) with ordinality as e(value,ord) where ord<=10 order by ord) t));
     changes:=changes||jsonb_build_object(pid,delta);
     if is_mvp then mvp_list:=mvp_list||to_jsonb(pid);end if;
   end if;
   new_players:=new_players||jsonb_build_array(p);
 end loop;
 new_match:=jsonb_build_object(
   'id',l.id,'date',now(),'game','BO7','mode',upper(l.mode),
   'format',case when l.mode='mixed' then 'MIX CDL' else upper(l.mode) end,
   'teamA',to_jsonb(l.team_a),'teamB',to_jsonb(l.team_b),'winner',consensus,
   'scoreA',case when consensus='A' then 1 else 0 end,
   'scoreB',case when consensus='B' then 1 else 0 end,
   'eloChanges',changes,'mvpIds',mvp_list,'pairings','[]'::jsonb,
   'ranked',true,'source','mucho-ranked','locked',true,
   'resultStatus','verified','verifiedAt',now());
 update public.app_state set players=new_players,matches=jsonb_build_array(new_match)||coalesce(st.matches,'[]'::jsonb),
   version=greatest(st.version+1,(extract(epoch from clock_timestamp())*1000)::bigint),updated_at=now()
   where id='main';
 update public.ranked_lobbies set status='completed',reported_winner=consensus,
   result_confirmed_at=now(),completed_at=now() where id=p_lobby_id;
 return true;
end $$;
revoke all on function public.ranked_finalize(uuid) from public,anon,authenticated;
