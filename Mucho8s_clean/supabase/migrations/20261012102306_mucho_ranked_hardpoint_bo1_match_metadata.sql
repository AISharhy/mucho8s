do $outer$
declare def text;
begin
 select pg_get_functiondef(oid) into def from pg_proc where oid='public.ranked_finalize(uuid)'::regprocedure;
 def:=replace(def,'''id'',l.id,''date'',now(),''game'',''BO7'',''mode'',upper(l.mode),','''id'',l.id,''date'',now(),''game'',''BO7'',''mode'',''Hardpoint'',');
 def:=replace(def,'''format'',case when l.mode=''mixed'' then ''MIX CDL'' else upper(l.mode) end,','''format'',''4v4'',''bestOf'',1,');
 def:=replace(def,'if l.status not in (''live'',''disputed'') then raise exception ''Lobby not live'';end if;','if l.status not in (''live'',''disputed'') then raise exception ''Lobby not live'';end if;');
 execute def;
end $outer$;
