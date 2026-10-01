-- MuchoTourney uses intermediate Switcheroo lifecycle states in addition to
-- setup/live/completed. Keep the DB constraint aligned with the app.
alter table public.tourney_state
  drop constraint if exists tourney_state_status_check;

alter table public.tourney_state
  add constraint tourney_state_status_check
  check (
    status = any (
      array[
        'setup'::text,
        'review'::text,
        'ready'::text,
        'live'::text,
        'completed'::text
      ]
    )
  );
