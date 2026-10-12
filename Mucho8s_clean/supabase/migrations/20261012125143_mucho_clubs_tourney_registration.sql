create or replace function public.club_register_tourney(p_account_id uuid,p_club_id uuid,p_roster text[]) returns jsonb language plpgsql security invoker set search_path=public as $$
declare t competitive_teams%rowtype; tr tourney_state%rowtype; pid text; size int; entry jsonb; roster jsonb;
begin
 select player_id into pid from player_accounts where id=p_account_id;
 if pid is null then raise exception 'Linked player required';end if;
 select * into t from competitive_teams where id=p_club_id for update;
 if not found or (t.owner_account_id<>p_account_id and t.captain_player_id<>pid) then raise exception 'Only club owner or captain can register';end if;
 select * into tr from tourney_state where id='current' for update;
 if not found or tr.status in ('live','completed') or coalesce(jsonb_array_length(tr.state->'bracket'),0)>0 or coalesce(tr.state->'switcheroo'->>'setupStage','')<>'published' or coalesce(tr.state->'switcheroo'->>'registrationMode','manual')<>'open' then raise exception 'Tournament club registration is not open';end if;
 if coalesce(tr.state->>'teamBuild','manual')='switcheroo' then raise exception 'Switcheroo uses individual registration';end if;
 if coalesce((tr.state->'switcheroo'->>'freeEntry')::boolean,false)=false then raise exception 'Paid entry: register and confirm payment through the existing tournament flow';end if;
 size:=split_part(coalesce(tr.state->>'format','4v4'),'v',1)::int;
 if cardinality(p_roster) is distinct from size or (select count(distinct x) from unnest(p_roster) x)<>size then raise exception 'Roster must match the tournament format';end if;
 if exists(select 1 from unnest(p_roster) x where not exists(select 1 from competitive_team_members where team_id=p_club_id and player_id=x)) then raise exception 'Roster must belong to the club';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(tr.state->'teams','[]')) x where x->>'clubId'=p_club_id::text) then raise exception 'Club already registered';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(tr.state->'teams','[]')) x,jsonb_array_elements(coalesce(x->'roster','[]')) p where p->>'id'=any(p_roster)) then raise exception 'A player is already registered with another roster';end if;
 if jsonb_array_length(coalesce(tr.state->'teams','[]'))>=coalesce((tr.state->'switcheroo'->>'maxTeams')::int,8) then raise exception 'Tournament full';end if;
 select jsonb_agg(jsonb_build_object('id',x->>'id','name',x->>'name')) into roster from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=any(p_roster);
 if jsonb_array_length(roster) is distinct from size then raise exception 'Roster player no longer active';end if;
 entry:=jsonb_build_object('id',gen_random_uuid(),'clubId',p_club_id,'name',t.name,'tag',t.tag,'logoUrl',t.logo_url,'roster',roster,'seed',jsonb_array_length(coalesce(tr.state->'teams','[]'))+1);
 tr.state:=jsonb_set(tr.state,'{teams}',coalesce(tr.state->'teams','[]')||jsonb_build_array(entry));
 tr.state:=jsonb_set(tr.state,'{switcheroo,entryPaid}',coalesce(tr.state->'switcheroo'->'entryPaid','[]')||to_jsonb(p_roster));
 update tourney_state set state=tr.state,updated_at=now(),updated_by=pid where id='current';
 return jsonb_build_object('ok',true,'tourney',tr.state);
end;$$;
revoke all on function public.club_register_tourney(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.club_register_tourney(uuid,uuid,text[]) to service_role;
