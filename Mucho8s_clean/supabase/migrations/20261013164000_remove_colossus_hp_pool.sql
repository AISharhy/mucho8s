-- Remove Colossus from all new BO7 Hardpoint ranked map selections.
create or replace function public.ranked_map_pool(p_mode text)
returns text[] language sql immutable set search_path=public as $$
  select case when p_mode='snd'
    then array['Den','Frequency','Gridlock','Raid','Scar','Hacienda','Fringe']
    else array['Den','Gridlock','Frequency','Scar','Hacienda']
  end;
$$;

create or replace function public.ranked_assign_hp_map()
returns trigger language plpgsql set search_path=public as $$
declare maps text[]:=array['Den','Gridlock','Frequency','Scar','Hacienda'];
begin
 if new.mode='hp' and (new.map_name is null or new.map_name='') then
   new.map_name:=maps[1+floor(random()*array_length(maps,1))::int];
 end if;
 return new;
end $$;

-- Preserve valid existing vote rows, but reject new votes for Colossus.
delete from public.ranked_map_votes where map_name='Colossus';
alter table public.ranked_map_votes drop constraint if exists ranked_map_votes_map_name_check;
alter table public.ranked_map_votes add constraint ranked_map_votes_map_name_check
check(map_name in ('Den','Gridlock','Frequency','Scar','Hacienda','Raid','Fringe'));
