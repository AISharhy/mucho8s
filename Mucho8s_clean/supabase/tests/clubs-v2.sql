begin;
do $$
declare a uuid[]; ids text[]; ca uuid; cb uuid; inv uuid; c jsonb; challenge_id uuid; mid uuid; i int; rejected boolean; before_matches jsonb;
begin
 select matches into before_matches from app_state where id='main';
 select array_agg(id),array_agg(player_id) into a,ids from(select id,player_id from player_accounts p where player_id is not null and exists(select 1 from app_state s,jsonb_array_elements(s.players) x where s.id='main' and x->>'id'=p.player_id) and not exists(select 1 from competitive_team_members m where m.player_id=p.player_id) and not exists(select 1 from competitive_teams t where t.owner_account_id=p.id) and not exists(select 1 from live_team_matches l where l.status='live' and(l.team_a||l.team_b)?p.player_id) order by id limit 8)t;
 if cardinality(a)<>8 then raise exception 'Eight idle linked players required';end if;
 insert into competitive_teams(name,tag,owner_account_id,captain_player_id) values('QA_ROLLBACK_ALPHA','QAA',a[1],ids[1]) returning id into ca;
 insert into competitive_teams(name,tag,owner_account_id,captain_player_id) values('QA_ROLLBACK_BRAVO','QAB',a[5],ids[5]) returning id into cb;
 insert into competitive_team_members(team_id,player_id,role) values(ca,ids[1],'captain'),(cb,ids[5],'captain');
 perform club_invite_action(a[1],'invite',ca,ids[2]);select id into inv from competitive_team_invites where team_id=ca and player_id=ids[2];
 rejected:=false;begin perform club_invite_action(a[3],'accept',ca,null,inv);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Wrong player accepted invite';end if;
 perform club_invite_action(a[2],'accept',ca,null,inv);
 if not exists(select 1 from competitive_team_members where team_id=ca and player_id=ids[2]) then raise exception 'Invite did not add member';end if;
 rejected:=false;begin perform club_invite_action(a[2],'accept',ca,null,inv);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Invite accepted twice';end if;
 perform club_invite_action(a[1],'set-captain',ca,ids[2]);
 if(select captain_player_id from competitive_teams where id=ca)<>ids[2] then raise exception 'Captain update failed';end if;
 for i in 3..4 loop insert into competitive_team_members(team_id,player_id) values(ca,ids[i]);end loop;
 for i in 6..8 loop insert into competitive_team_members(team_id,player_id) values(cb,ids[i]);end loop;
 c:=club_challenge_action(a[1],'challenge',jsonb_build_object('teamId',ca,'opponentId',cb,'teamA',to_jsonb(ids[1:4]),'teamB',to_jsonb(ids[5:8]),'mode','snd'));challenge_id:=(c->'challenge'->>'id')::uuid;
 rejected:=false;begin perform club_challenge_action(a[1],'accept-challenge',jsonb_build_object('challengeId',challenge_id));exception when others then rejected:=true;end;
 if not rejected then raise exception 'Own club accepted challenge';end if;
 c:=club_challenge_action(a[5],'accept-challenge',jsonb_build_object('challengeId',challenge_id));mid:=(c->'challenge'->>'live_match_id')::uuid;
 if not exists(select 1 from live_team_matches where id=mid and club_a_id=ca and club_b_id=cb and jsonb_array_length(maps)=3 and not maps?'Standoff') then raise exception 'Shared club room/maps failure';end if;
 if (select matches from app_state where id='main') is distinct from before_matches then raise exception 'Club preparation changed history';end if;
 -- Configure a test-only published free Classic tournament; the change is rolled back.
 update tourney_state set state=jsonb_build_object('name','QA_ROLLBACK_TOURNEY','format','4v4','teamBuild','manual','teams','[]'::jsonb,'bracket','[]'::jsonb,'switcheroo',jsonb_build_object('setupStage','published','registrationMode','open','freeEntry',true,'maxTeams',4,'entryPaid','[]'::jsonb)),status='ready' where id='current';
 c:=club_register_tourney(a[1],ca,ids[1:4]);
 if jsonb_array_length(c->'tourney'->'teams')<>1 then raise exception 'Tournament roster registration failed';end if;
 rejected:=false;begin perform club_register_tourney(a[1],ca,ids[1:4]);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Duplicate club registration accepted';end if;
end;$$;
rollback;
