begin;
do $$
declare rid uuid; token uuid; v bigint; ps jsonb; ms jsonb; rejected boolean;
begin
 insert into team_match_reports(match_id,team_a,team_b,winner,status,captain_a_player_id,captain_b_player_id) values('qa-report-'||gen_random_uuid(),'["qa-a1","qa-a2"]','["qa-b1","qa-b2"]','A','pending','qa-a1','qa-b1') returning id into rid;
 token:=claim_match_report(rid,false);
 rejected:=false;begin perform claim_match_report(rid,false);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Duplicate claim accepted';end if;
 select version,players,matches into v,ps,ms from app_state where id='main';
 rejected:=false;begin perform commit_match_state(rid,gen_random_uuid(),v,ps,ms);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Invalid claim committed';end if;
 if commit_match_state(rid,token,v-1,ps,ms) then raise exception 'Stale version committed';end if;
 if not commit_match_state(rid,token,v,ps,ms) then raise exception 'Valid claim failed';end if;
 if(select version from app_state where id='main')<=v then raise exception 'Version not monotonic';end if;
 if(select matches from app_state where id='main') is distinct from ms then raise exception 'Test changed match history';end if;
end;$$;
rollback;
