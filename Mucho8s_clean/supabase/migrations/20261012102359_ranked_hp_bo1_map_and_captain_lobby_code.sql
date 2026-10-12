alter table public.ranked_lobbies add column if not exists map_name text;
alter table public.ranked_lobbies add column if not exists lobby_code text;
alter table public.ranked_lobbies add column if not exists lobby_code_updated_at timestamptz;
alter table public.ranked_lobbies add constraint ranked_lobby_code_format check (lobby_code is null or (char_length(lobby_code) between 3 and 32 and lobby_code ~ '^[A-Z0-9_-]+$'));
create or replace function public.ranked_set_lobby_code(p_lobby_id uuid,p_account_id uuid,p_code text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare l public.ranked_lobbies%rowtype; caller_player text; normalized text;
begin
 select * into l from public.ranked_lobbies where id=p_lobby_id for update;
 if not found or l.status <> 'live' then raise exception 'Lobby not live'; end if;
 select player_id into caller_player from public.ranked_lobby_players
 where lobby_id=p_lobby_id and account_id=p_account_id;
 if caller_player is null or caller_player is distinct from l.team_a[1] then
  raise exception 'Only the designated captain can set the lobby code';
 end if;
 normalized := upper(trim(p_code));
 if normalized !~ '^[A-Z0-9_-]{3,32}$' then raise exception 'Invalid lobby code'; end if;
 update public.ranked_lobbies set lobby_code=normalized,lobby_code_updated_at=now()
 where id=p_lobby_id;
 return true;
end $$;
revoke all on function public.ranked_set_lobby_code(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ranked_set_lobby_code(uuid,uuid,text) to service_role;
