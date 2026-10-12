-- Applied and verified on Mucho8s Supabase.
-- Trigger execution remains active; browser roles cannot invoke these internal functions.
REVOKE EXECUTE ON FUNCTION public.enforce_mucho8s_awards_v4() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_mucho8s_awards_v5() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_mucho8s_awards_v6() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_mucho8s_progressive_elo_v7() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_completed_report_awards_v4() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_completed_report_awards_v5() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_completed_report_awards_v6() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_completed_report_awards_v7() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.adjust_player_elo_json(jsonb,text,numeric,boolean) SET search_path = pg_catalog, public;
