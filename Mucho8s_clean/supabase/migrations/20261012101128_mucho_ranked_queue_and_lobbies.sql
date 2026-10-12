
create table if not exists public.ranked_queue (
 account_id uuid primary key references public.player_accounts(id) on delete cascade,
 player_id text not null unique,
 mode text not null check (mode in ('snd','hp','mixed')),
 joined_at timestamptz not null default now()
);
create table if not exists public.ranked_lobbies (
 id uuid primary key default gen_random_uuid(),
 mode text not null check (mode in ('snd','hp','mixed')),
 status text not null default 'ready' check (status in ('ready','live','cancelled','completed','disputed')),
 team_a text[] not null,
 team_b text[] not null,
 player_ids text[] not null,
 created_at timestamptz not null default now(),
 ready_deadline timestamptz not null default (now()+ interval '90 seconds'),
 reported_winner text check (reported_winner in ('A','B')),
 result_confirmed_at timestamptz,
 completed_at timestamptz
);
create table if not exists public.ranked_lobby_players (
 lobby_id uuid not null references public.ranked_lobbies(id) on delete cascade,
 account_id uuid not null references public.player_accounts(id) on delete cascade,
 player_id text not null,
 ready boolean not null default false,
 report text check (report in ('A','B')),
 primary key (lobby_id,account_id),
 unique(lobby_id,player_id)
);
create unique index if not exists ranked_one_active_lobby_per_account on public.ranked_lobby_players(account_id) where false;
create index if not exists ranked_queue_mode_time on public.ranked_queue(mode,joined_at);
create index if not exists ranked_lobby_players_account on public.ranked_lobby_players(account_id);
alter table public.ranked_queue enable row level security;
alter table public.ranked_lobbies enable row level security;
alter table public.ranked_lobby_players enable row level security;
revoke all on public.ranked_queue,public.ranked_lobbies,public.ranked_lobby_players from anon, authenticated;
-- All mutation is through a service-role-only RPC, invoked by an authenticated Edge Function.
create or replace function public.ranked_find_match(p_mode text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare
 r record;
 ids text[] := '{}';
 accounts uuid[] := '{}';
 ratings integer[] := '{}';
 result_id uuid;
 team_a text[] := '{}';
 team_b text[] := '{}';
 best_diff bigint := 9223372036854775807;
 current_diff bigint;
 mask integer;
 i integer;
 sum_a bigint;
 sum_b bigint;
 count_a integer;
 player jsonb;
 state_players jsonb;
begin
 if p_mode not in ('snd','hp','mixed') then raise exception 'Invalid mode'; end if;
 perform pg_advisory_xact_lock(hashtext('mucho-ranked-'||p_mode));
 select players into state_players from public.app_state where id='main';
 for r in select q.account_id,q.player_id from public.ranked_queue q
          where q.mode=p_mode order by q.joined_at limit 8 for update skip locked loop
   ids:=array_append(ids,r.player_id);
   accounts:=array_append(accounts,r.account_id);
   select x into player from jsonb_array_elements(coalesce(state_players,'[]'::jsonb)) x where x->>'id'=r.player_id limit 1;
   ratings:=array_append(ratings,greatest(500,coalesce(nullif(player->>'currentElo','')::integer,1000)));
 end loop;
 if array_length(ids,1) is distinct from 8 then return null; end if;
 for mask in 0..127 loop
   count_a:=1;sum_a:=ratings[1];sum_b:=0;
   for i in 2..8 loop
     if (mask & (1 << (i-2)))<>0 then count_a:=count_a+1;sum_a:=sum_a+ratings[i];
     else sum_b:=sum_b+ratings[i]; end if;
   end loop;
   if count_a=4 then
     current_diff:=abs(sum_a-sum_b);
     if current_diff<best_diff then
       best_diff:=current_diff;team_a:=array[ids[1]];team_b:='{}';
       for i in 2..8 loop
         if (mask & (1 << (i-2)))<>0 then team_a:=array_append(team_a,ids[i]);
         else team_b:=array_append(team_b,ids[i]);end if;
       end loop;
     end if;
   end if;
 end loop;
 insert into public.ranked_lobbies(mode,team_a,team_b,player_ids) values(p_mode,team_a,team_b,ids) returning id into result_id;
 for i in 1..8 loop
  insert into public.ranked_lobby_players(lobby_id,account_id,player_id) values(result_id,accounts[i],ids[i]);
 end loop;
 delete from public.ranked_queue where account_id=any(accounts);
 return result_id;
end $$;
revoke all on function public.ranked_find_match(text) from public,anon,authenticated;
