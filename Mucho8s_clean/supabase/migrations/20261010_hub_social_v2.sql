-- Hub social v2. All client-facing tables use RLS and linked Discord accounts.
create table if not exists public.hub_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.player_accounts(id) on delete cascade,
 body text not null default '' check (char_length(body)<=2000),
 media_url text,
 media_kind text check (media_kind in ('image','twitch','video')),
 pinned boolean not null default false,
 hidden boolean not null default false,
 created_at timestamptz not null default now(),
 constraint hub_post_content check (length(trim(body))>0 or media_url is not null)
);
create table if not exists public.hub_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.hub_posts(id) on delete cascade,
 author_id uuid not null references public.player_accounts(id) on delete cascade,
 parent_id uuid references public.hub_comments(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 500),
 created_at timestamptz not null default now()
);
create table if not exists public.hub_likes (
 post_id uuid not null references public.hub_posts(id) on delete cascade,
 user_id uuid not null references public.player_accounts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.hub_polls (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null unique references public.hub_posts(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create table if not exists public.hub_poll_options (
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null references public.hub_polls(id) on delete cascade,
 label text not null check (char_length(label) between 1 and 120),
 position integer not null check (position between 0 and 5),
 unique(poll_id,position),
 unique(id,poll_id)
);
create table if not exists public.hub_votes (
 poll_id uuid not null references public.hub_polls(id) on delete cascade,
 option_id uuid not null,
 user_id uuid not null references public.player_accounts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(poll_id,user_id),
 foreign key(option_id,poll_id) references public.hub_poll_options(id,poll_id) on delete cascade
);
create table if not exists public.hub_reports (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.hub_posts(id) on delete cascade,
 reporter_id uuid not null references public.player_accounts(id) on delete cascade,
 reason text not null check (char_length(reason) between 5 and 500),
 status text not null default 'open' check (status in ('open','resolved','dismissed')),
 created_at timestamptz not null default now(),
 unique(post_id,reporter_id)
);
create table if not exists public.hub_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.player_accounts(id) on delete cascade,
 actor_id uuid references public.player_accounts(id) on delete set null,
 post_id uuid references public.hub_posts(id) on delete cascade,
 kind text not null check (kind in ('like','comment','reply')),
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists hub_posts_latest_idx on public.hub_posts(created_at desc) where not hidden;
create index if not exists hub_comments_post_idx on public.hub_comments(post_id,created_at);
create index if not exists hub_notifications_recipient_idx on public.hub_notifications(recipient_id,created_at desc);
-- player_accounts is intentionally not directly readable by clients, so use a narrow
-- security-definer helper in a non-exposed schema for membership verification.
create schema if not exists hub_private;
create or replace function hub_private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.player_accounts a where a.id=(select auth.uid()) and a.player_id is not null)
 $$;
revoke all on function hub_private.is_member() from public,anon;
grant usage on schema hub_private to authenticated;
grant execute on function hub_private.is_member() to authenticated;
-- Only signed-in members can access community data.
do $$ declare t text; begin
 foreach t in array array['hub_posts','hub_comments','hub_likes','hub_polls','hub_poll_options','hub_votes','hub_reports','hub_notifications'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon,authenticated', t);
 end loop;
end $$;
grant select,insert,delete on public.hub_posts to authenticated;
grant select,insert,delete on public.hub_comments to authenticated;
grant select,insert,delete on public.hub_likes to authenticated;
grant select,insert on public.hub_polls to authenticated;
grant select,insert on public.hub_poll_options to authenticated;
grant select,insert on public.hub_votes to authenticated;
grant select,insert on public.hub_reports to authenticated;
grant select,update on public.hub_notifications to authenticated;
create policy hub_posts_read on public.hub_posts for select to authenticated using (hub_private.is_member() and not hidden);
create policy hub_posts_write on public.hub_posts for insert to authenticated with check (hub_private.is_member() and author_id=(select auth.uid()) and not pinned and not hidden);
create policy hub_posts_delete on public.hub_posts for delete to authenticated using (hub_private.is_member() and author_id=(select auth.uid()));
create policy hub_comments_read on public.hub_comments for select to authenticated using (hub_private.is_member() and exists(select 1 from public.hub_posts p where p.id=post_id));
create policy hub_comments_write on public.hub_comments for insert to authenticated with check (hub_private.is_member() and author_id=(select auth.uid()) and exists(select 1 from public.hub_posts p where p.id=post_id) and (parent_id is null or exists(select 1 from public.hub_comments c where c.id=parent_id and c.post_id=post_id)));
create policy hub_comments_delete on public.hub_comments for delete to authenticated using (hub_private.is_member() and author_id=(select auth.uid()));
create policy hub_likes_read on public.hub_likes for select to authenticated using (hub_private.is_member());
create policy hub_likes_write on public.hub_likes for insert to authenticated with check (hub_private.is_member() and user_id=(select auth.uid()));
create policy hub_likes_delete on public.hub_likes for delete to authenticated using (hub_private.is_member() and user_id=(select auth.uid()));
create policy hub_polls_read on public.hub_polls for select to authenticated using (hub_private.is_member());
create policy hub_polls_write on public.hub_polls for insert to authenticated with check (hub_private.is_member() and exists(select 1 from public.hub_posts p where p.id=post_id and p.author_id=(select auth.uid())));
create policy hub_options_read on public.hub_poll_options for select to authenticated using (hub_private.is_member());
create policy hub_options_write on public.hub_poll_options for insert to authenticated with check (hub_private.is_member() and exists(select 1 from public.hub_polls poll join public.hub_posts post on poll.post_id=post.id where poll.id=poll_id and post.author_id=(select auth.uid())));
create policy hub_votes_read on public.hub_votes for select to authenticated using (hub_private.is_member());
create policy hub_votes_write on public.hub_votes for insert to authenticated with check (hub_private.is_member() and user_id=(select auth.uid()) and exists(select 1 from public.hub_polls p where p.id=poll_id and p.expires_at>now()));
create policy hub_reports_read on public.hub_reports for select to authenticated using (hub_private.is_member() and reporter_id=(select auth.uid()));
create policy hub_reports_write on public.hub_reports for insert to authenticated with check (hub_private.is_member() and reporter_id=(select auth.uid()));
create policy hub_notifications_read on public.hub_notifications for select to authenticated using (hub_private.is_member() and recipient_id=(select auth.uid()));
create policy hub_notifications_update on public.hub_notifications for update to authenticated using (hub_private.is_member() and recipient_id=(select auth.uid())) with check (recipient_id=(select auth.uid()));
-- Never allow arbitrary image hosts or javascript links via user-supplied URLs in UI.
-- Admin pinning and moderation intentionally require server-side admin session validation.

-- Private media bucket. Uploads must be owned and signed URLs expire.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hub-media','hub-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy hub_media_select on storage.objects for select to authenticated
 using (bucket_id='hub-media' and hub_private.is_member());
create policy hub_media_upload on storage.objects for insert to authenticated
 with check(bucket_id='hub-media' and hub_private.is_member() and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy hub_media_delete on storage.objects for delete to authenticated
 using(bucket_id='hub-media' and hub_private.is_member() and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Notifications: server-owned triggers, write access withheld from clients.
create or replace function hub_private.notify_interaction()
returns trigger language plpgsql security definer set search_path='' as $function$
declare owner_id uuid; actor_id uuid; notification_kind text;
begin
 select p.author_id into owner_id from public.hub_posts p where p.id=new.post_id;
 if tg_table_name='hub_likes' then actor_id:=new.user_id; notification_kind:='like';
 else actor_id:=new.author_id; notification_kind:='comment'; end if;
 if owner_id is not null and owner_id<>actor_id then
  insert into public.hub_notifications(recipient_id,actor_id,post_id,kind)
  values(owner_id,actor_id,new.post_id,notification_kind);
 end if;
 return new;
end;
$function$;
revoke all on function hub_private.notify_interaction() from public,anon,authenticated;
drop trigger if exists hub_notify_like on public.hub_likes;
create trigger hub_notify_like after insert on public.hub_likes for each row execute function hub_private.notify_interaction();
drop trigger if exists hub_notify_comment on public.hub_comments;
create trigger hub_notify_comment after insert on public.hub_comments for each row execute function hub_private.notify_interaction();
revoke update on public.hub_notifications from authenticated;
grant update(is_read) on public.hub_notifications to authenticated;

-- Narrow membership probe; does not expose account records.
create or replace function public.hub_member_status()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.player_accounts a where a.id=(select auth.uid()) and a.player_id is not null)
$$;
revoke all on function public.hub_member_status() from public,anon;
grant execute on function public.hub_member_status() to authenticated;
