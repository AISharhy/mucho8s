create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 1200),
  category text not null default 'Platform',
  accent text not null default '#FF2A3B',
  featured boolean not null default false,
  published boolean not null default true,
  author_player_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_posts_public_idx
  on public.news_posts (published, featured desc, created_at desc);

alter table public.news_posts enable row level security;
revoke all on table public.news_posts from anon, authenticated;
grant select on table public.news_posts to anon, authenticated;

drop policy if exists "Public can read published news" on public.news_posts;
create policy "Public can read published news"
  on public.news_posts
  for select
  to anon, authenticated
  using (published = true);
