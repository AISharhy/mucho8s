-- Clear legacy manual MVP values from completed reports that no longer have a match in app_state.
with active_matches as (
  select m->>'id' as match_id
  from public.app_state,
  lateral jsonb_array_elements(matches) m
  where id = 'main'
)
update public.team_match_reports r
set
  mvp_id = null,
  mvp_ids = '[]'::jsonb
where r.status = 'completed'
  and not exists (
    select 1
    from active_matches a
    where a.match_id = r.match_id::text
  );
