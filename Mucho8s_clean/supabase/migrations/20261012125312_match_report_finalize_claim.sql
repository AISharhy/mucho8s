alter table public.team_match_reports add column if not exists finalize_token uuid;
alter table public.team_match_reports add column if not exists finalize_started_at timestamptz;
create or replace function public.claim_match_report(p_id uuid,p_allow_disputed boolean default false) returns uuid language plpgsql security invoker set search_path=public as $$
declare r team_match_reports%rowtype; token uuid;
begin
 select * into r from team_match_reports where id=p_id for update;
 if not found or (r.status<>'pending' and not(p_allow_disputed and r.status='disputed')) then raise exception 'Report is no longer awaiting confirmation';end if;
 if r.finalize_token is not null and r.finalize_started_at>now()-interval '5 minutes' then raise exception 'Another confirmation is in progress';end if;
 token:=gen_random_uuid();update team_match_reports set finalize_token=token,finalize_started_at=now() where id=p_id;return token;
end;$$;
create or replace function public.commit_match_state(p_report_id uuid,p_token uuid,p_version bigint,p_players jsonb,p_matches jsonb) returns boolean language plpgsql security invoker set search_path=public as $$
declare r team_match_reports%rowtype; v bigint;
begin
 select * into r from team_match_reports where id=p_report_id for update;
 if not found or r.finalize_token is distinct from p_token or p_token is null or r.status not in ('pending','disputed') then raise exception 'Confirmation claim no longer valid';end if;
 select version into v from app_state where id='main' for update;
 if v is distinct from p_version then return false;end if;
 update app_state set players=p_players,matches=p_matches,version=greatest(v+1,(extract(epoch from clock_timestamp())*1000)::bigint),updated_at=now() where id='main';return true;
end;$$;
revoke all on function public.claim_match_report(uuid,boolean), public.commit_match_state(uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.claim_match_report(uuid,boolean),public.commit_match_state(uuid,uuid,bigint,jsonb,jsonb) to service_role;
