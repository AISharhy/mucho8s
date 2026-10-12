create table public.competitive_team_invites (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.competitive_teams(id) on delete cascade,
 player_id text not null,
 invited_by_account_id uuid not null references public.player_accounts(id),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 responded_at timestamptz
);
create unique index competitive_team_invites_pending on public.competitive_team_invites(team_id,player_id) where status='pending';
create index competitive_team_invites_player on public.competitive_team_invites(player_id,status);
alter table public.competitive_team_invites enable row level security;
revoke all on public.competitive_team_invites from anon,authenticated;
grant all on public.competitive_team_invites to service_role;
create or replace function public.club_invite_action(p_account_id uuid,p_action text,p_team_id uuid,p_player_id text default null,p_invite_id uuid default null) returns jsonb language plpgsql security invoker set search_path=public as $$
declare pid text; t competitive_teams%rowtype; inv competitive_team_invites%rowtype;
begin
 select player_id into pid from player_accounts where id=p_account_id;
 if pid is null or not exists(select 1 from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=pid) then raise exception 'Linked active player required';end if;
 select * into t from competitive_teams where id=p_team_id for update;
 if not found then raise exception 'Club not found';end if;
 if p_action='invite' then
  if t.owner_account_id<>p_account_id then raise exception 'Only the owner may invite';end if;
  if not exists(select 1 from player_accounts where player_id=p_player_id) or not exists(select 1 from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=p_player_id) then raise exception 'Target must have a linked active account';end if;
  if exists(select 1 from competitive_team_members where player_id=p_player_id) then raise exception 'Player already belongs to a club';end if;
  update competitive_team_invites set status='cancelled',responded_at=now() where team_id=p_team_id and player_id=p_player_id and status='pending' and expires_at<=now();
  insert into competitive_team_invites(team_id,player_id,invited_by_account_id) values(p_team_id,p_player_id,p_account_id) on conflict(team_id,player_id) where status='pending' do nothing;
 elsif p_action in ('accept','decline') then
  select * into inv from competitive_team_invites where id=p_invite_id and team_id=p_team_id for update;
  if not found or inv.player_id<>pid or inv.status<>'pending' or inv.expires_at<=now() then raise exception 'Invalid or expired invite';end if;
  if p_action='accept' then
   if (select count(*) from competitive_team_members where team_id=p_team_id)>=8 then raise exception 'Club roster is full';end if;
   insert into competitive_team_members(team_id,player_id,role) values(p_team_id,pid,'member');
  end if;
  update competitive_team_invites set status=case when p_action='accept' then 'accepted' else 'declined' end,responded_at=now() where id=inv.id;
 elsif p_action='set-captain' then
  if t.owner_account_id<>p_account_id then raise exception 'Only owner may assign captain';end if;
  if not exists(select 1 from competitive_team_members where team_id=p_team_id and player_id=p_player_id) then raise exception 'Captain must be a member';end if;
  update competitive_team_members set role=case when player_id=p_player_id then 'captain' else 'member' end where team_id=p_team_id;
  update competitive_teams set captain_player_id=p_player_id,updated_at=now() where id=p_team_id;
 else raise exception 'Invalid club action';end if;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.club_invite_action(uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.club_invite_action(uuid,text,uuid,text,uuid) to service_role;
