alter table public.ranked_lobbies drop constraint if exists ranked_lobbies_status_check;
alter table public.ranked_lobbies add constraint ranked_lobbies_status_check check(status in ('ready','vote','live','cancelled','completed','disputed'));
create table if not exists public.ranked_map_votes(
 lobby_id uuid not null references public.ranked_lobbies(id) on delete cascade,
 account_id uuid not null references public.player_accounts(id) on delete cascade,
 map_name text not null check(map_name in ('Colossus','Den','Gridlock','Frequency','Scar','Hacienda')),
 created_at timestamptz not null default now(),
 primary key(lobby_id,account_id)
);
alter table public.ranked_map_votes enable row level security;
revoke all on public.ranked_map_votes from anon,authenticated;
-- Do not randomly select the map: eight participating players vote instead.
drop trigger if exists ranked_hp_map_default on public.ranked_lobbies;
create or replace function public.ranked_cast_map_vote(p_lobby_id uuid,p_account_id uuid,p_map text)
returns text language plpgsql security invoker set search_path=public as $$
declare l public.ranked_lobbies%rowtype; number_votes int; result_map text;
begin
 select * into l from public.ranked_lobbies where id=p_lobby_id for update;
 if not found or l.status<>'vote' then raise exception 'Voting is not active'; end if;
 if not exists(select 1 from public.ranked_lobby_players where lobby_id=p_lobby_id and account_id=p_account_id)
 then raise exception 'Not a match participant';end if;
 if p_map not in ('Colossus','Den','Gridlock','Frequency','Scar','Hacienda') then raise exception 'Invalid map';end if;
 insert into public.ranked_map_votes(lobby_id,account_id,map_name) values(p_lobby_id,p_account_id,p_map)
 on conflict(lobby_id,account_id) do nothing;
 select count(*) into number_votes from public.ranked_map_votes where lobby_id=p_lobby_id;
 if number_votes=8 then
   select map_name into result_map from public.ranked_map_votes where lobby_id=p_lobby_id
   group by map_name order by count(*) desc,map_name asc limit 1;
   update public.ranked_lobbies set map_name=result_map,status='live' where id=p_lobby_id;
 end if;
 return coalesce(result_map,'');
end $$;
revoke all on function public.ranked_cast_map_vote(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ranked_cast_map_vote(uuid,uuid,text) to service_role;
