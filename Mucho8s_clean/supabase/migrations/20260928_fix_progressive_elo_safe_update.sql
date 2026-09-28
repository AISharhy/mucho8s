-- Fix Supabase safe-update rejection inside the progressive Elo trigger.
-- The temporary state table uses player_id as a NOT NULL primary key, so this
-- predicate intentionally targets every temp row while still satisfying the
-- database safe-update guard.

do $$
declare
  v_definition text;
  v_unsafe text := 'update tmp_m8_v7_state set last_general_bonus = 0;';
  v_safe text := E'update tmp_m8_v7_state\n    set last_general_bonus = 0\n    where player_id is not null;';
begin
  select pg_get_functiondef('public.enforce_mucho8s_progressive_elo_v7()'::regprocedure)
    into v_definition;

  if position(v_unsafe in v_definition) > 0 then
    execute replace(v_definition, v_unsafe, v_safe);
  elsif position('where player_id is not null;' in v_definition) = 0 then
    raise exception 'Could not patch enforce_mucho8s_progressive_elo_v7 safely';
  end if;
end;
$$;
