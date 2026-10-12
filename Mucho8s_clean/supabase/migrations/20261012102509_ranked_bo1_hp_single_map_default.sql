create or replace function public.ranked_assign_hp_map()
returns trigger language plpgsql set search_path=public as $$
declare maps text[]:=array['Colossus','Den','Gridlock','Frequency','Scar','Hacienda'];
begin
 if new.mode='hp' and (new.map_name is null or new.map_name='') then
   new.map_name:=maps[1+floor(random()*array_length(maps,1))::int];
 end if;
 return new;
end $$;
drop trigger if exists ranked_hp_map_default on public.ranked_lobbies;
create trigger ranked_hp_map_default before insert on public.ranked_lobbies
for each row execute function public.ranked_assign_hp_map();
revoke all on function public.ranked_assign_hp_map() from public,anon,authenticated;
