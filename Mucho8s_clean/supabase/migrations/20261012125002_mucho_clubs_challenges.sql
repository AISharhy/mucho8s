alter table public.live_team_matches add column if not exists club_a_id uuid references public.competitive_teams(id) on delete set null;
alter table public.live_team_matches add column if not exists club_b_id uuid references public.competitive_teams(id) on delete set null;
create table public.competitive_club_challenges (
 id uuid primary key default gen_random_uuid(),
 club_a_id uuid not null references public.competitive_teams(id) on delete cascade,
 club_b_id uuid not null references public.competitive_teams(id) on delete cascade,
 team_a text[] not null, team_b text[] not null,
 mode text not null check(mode in ('hp','snd')),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '24 hours'),
 live_match_id uuid references public.live_team_matches(id),
 check(club_a_id<>club_b_id)
);
create index competitive_club_challenges_clubs on public.competitive_club_challenges(club_a_id,club_b_id,status);
alter table public.competitive_club_challenges enable row level security;
revoke all on public.competitive_club_challenges from anon,authenticated;
grant all on public.competitive_club_challenges to service_role;
create or replace function public.club_challenge_action(p_account_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare pid text; t competitive_teams%rowtype; opponent competitive_teams%rowtype; c competitive_club_challenges%rowtype; a text[]; b text[]; pool text[]; chosen text[]; previous jsonb; mid uuid; i int; room_mode text; m text; pairs jsonb:='[]';
begin
 select player_id into pid from player_accounts where id=p_account_id;
 if pid is null then raise exception 'Linked player required';end if;
 if p_action='challenge' then
  select * into t from competitive_teams where id=(p_payload->>'teamId')::uuid for update;
  if not found or (t.owner_account_id<>p_account_id and t.captain_player_id<>pid) then raise exception 'Only owner or captain can challenge';end if;
  select * into opponent from competitive_teams where id=(p_payload->>'opponentId')::uuid;
  if not found or opponent.id=t.id then raise exception 'Invalid opponent club';end if;
  select array_agg(value) into a from jsonb_array_elements_text(p_payload->'teamA');
  select array_agg(value) into b from jsonb_array_elements_text(p_payload->'teamB');
  if cardinality(a) not between 2 and 4 or cardinality(a) is distinct from cardinality(b) or not pid=any(a) then raise exception 'Choose equal rosters of 2-4 players including yourself';end if;
  if p_payload->>'mode' not in ('hp','snd') then raise exception 'Invalid mode';end if;
  if (select count(distinct x) from unnest(a||b) x)<>cardinality(a||b) then raise exception 'Duplicate roster player';end if;
  if exists(select 1 from unnest(a) x where not exists(select 1 from competitive_team_members where team_id=t.id and player_id=x)) or exists(select 1 from unnest(b) x where not exists(select 1 from competitive_team_members where team_id=opponent.id and player_id=x)) then raise exception 'Roster must belong to the clubs';end if;
  insert into competitive_club_challenges(club_a_id,club_b_id,team_a,team_b,mode) values(t.id,opponent.id,a,b,p_payload->>'mode') returning * into c;
 elsif p_action in ('accept-challenge','decline-challenge') then
  select * into c from competitive_club_challenges where id=(p_payload->>'challengeId')::uuid for update;
  if not found or c.status<>'pending' or c.expires_at<=now() then raise exception 'Challenge no longer pending';end if;
  select * into t from competitive_teams where id=c.club_b_id;
  if t.owner_account_id<>p_account_id and t.captain_player_id<>pid then raise exception 'Only opponent owner or captain may respond';end if;
  if p_action='accept-challenge' then
   if not pid=any(c.team_b) then raise exception 'Accepting captain must be in the selected roster';end if;
   if exists(select 1 from unnest(c.team_a) x where not exists(select 1 from competitive_team_members where team_id=c.club_a_id and player_id=x)) or exists(select 1 from unnest(c.team_b) x where not exists(select 1 from competitive_team_members where team_id=c.club_b_id and player_id=x)) then raise exception 'Roster changed; create a new challenge';end if;
   if exists(select 1 from live_team_matches l,unnest(c.team_a||c.team_b) x where l.status='live' and (l.team_a||l.team_b) ? x) then raise exception 'A player already has a Live match';end if;
   room_mode:=case when c.mode='snd' then 'Search & Destroy' else 'Hardpoint' end;
   pool:=ranked_map_pool(c.mode);
   if c.mode='snd' and cardinality(c.team_a)<4 then pool:=array_remove(pool,'Fringe')||array['Standoff'];end if;
   select maps into previous from live_team_matches where game='BO7' and mode=room_mode order by created_at desc limit 1;
   select array_agg(map) into chosen from (select x map from unnest(pool) x order by coalesce(previous ? x,false),random() limit 3) candidates;
   for i in 1..cardinality(c.team_a) loop pairs:=pairs||jsonb_build_array(jsonb_build_object('playerAId',c.team_a[i],'playerBId',c.team_b[i],'amount',0,'platform','free'));end loop;
   insert into live_team_matches(match_id,team_a,team_b,game,mode,format,maps,pairings,captain_player_id,creator_account_id,club_a_id,club_b_id)
    values(gen_random_uuid()::text,to_jsonb(c.team_a),to_jsonb(c.team_b),'BO7',room_mode,cardinality(c.team_a)||'v'||cardinality(c.team_b),to_jsonb(chosen),pairs,pid,p_account_id,c.club_a_id,c.club_b_id) returning id into mid;
  end if;
  update competitive_club_challenges set status=case when p_action='accept-challenge' then 'accepted' else 'declined' end,live_match_id=mid where id=c.id returning * into c;
 else raise exception 'Invalid action';end if;
 return jsonb_build_object('ok',true,'challenge',to_jsonb(c));
end;$$;
revoke all on function public.club_challenge_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.club_challenge_action(uuid,text,jsonb) to service_role;
