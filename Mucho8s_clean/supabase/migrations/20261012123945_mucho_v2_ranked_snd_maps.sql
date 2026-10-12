alter table public.ranked_map_votes drop constraint ranked_map_votes_map_name_check;
alter table public.ranked_map_votes add constraint ranked_map_votes_map_name_check check(map_name in ('Colossus','Den','Gridlock','Frequency','Scar','Hacienda','Raid','Fringe'));
