-- MADAR public blog, controlled editorial access, public engagement and careers upgrades.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null check (category_slug in ('general','business-management','artificial-intelligence','merchant-guides','educational')),
  slug text not null unique,
  title text not null check (char_length(title) between 4 and 180),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  content text not null check (char_length(content) >= 20),
  status text not null default 'draft' check (status in ('draft','published')),
  media_type text check (media_type is null or media_type in ('image','video')),
  media_url text,
  media_path text,
  author_id uuid not null references public.profiles(id) on delete restrict,
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  shares_count integer not null default 0 check (shares_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_media_consistency check (
    (media_type is null and media_url is null and media_path is null)
    or (media_type is not null and media_url is not null and media_path is not null)
  )
);

create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  author_name text not null check (char_length(author_name) between 2 and 80),
  body text not null check (char_length(body) between 2 and 1200),
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (post_id, visitor_hash)
);

create table if not exists public.blog_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists blog_posts_public_listing_idx on public.blog_posts(status, category_slug, published_at desc);
create index if not exists blog_comments_post_created_idx on public.blog_comments(post_id, created_at asc) where is_visible;
create index if not exists blog_likes_post_idx on public.blog_likes(post_id);
create index if not exists blog_shares_post_idx on public.blog_shares(post_id);

create or replace function public.can_manage_blog()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'active'
      and role in ('SUPER_ADMIN','EDITOR')
  );
$$;
revoke all on function public.can_manage_blog() from public;
grant execute on function public.can_manage_blog() to authenticated, service_role;

create or replace function public.sync_blog_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.blog_posts set likes_count = likes_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.blog_posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;
revoke all on function public.sync_blog_like_count() from public;

create or replace function public.sync_blog_share_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.blog_posts set shares_count = shares_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.blog_posts set shares_count = greatest(shares_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;
revoke all on function public.sync_blog_share_count() from public;

create or replace function public.sync_blog_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_visible then update public.blog_posts set comments_count = comments_count + 1 where id = new.post_id; end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.is_visible then update public.blog_posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id; end if;
    return old;
  end if;
  if old.is_visible is distinct from new.is_visible then
    update public.blog_posts
    set comments_count = greatest(comments_count + case when new.is_visible then 1 else -1 end, 0)
    where id = new.post_id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_blog_comment_count() from public;

drop trigger if exists blog_posts_touch_updated on public.blog_posts;
create trigger blog_posts_touch_updated before update on public.blog_posts for each row execute function public.touch_updated_at();
drop trigger if exists blog_likes_counter on public.blog_likes;
create trigger blog_likes_counter after insert or delete on public.blog_likes for each row execute function public.sync_blog_like_count();
drop trigger if exists blog_shares_counter on public.blog_shares;
create trigger blog_shares_counter after insert or delete on public.blog_shares for each row execute function public.sync_blog_share_count();
drop trigger if exists blog_comments_counter on public.blog_comments;
create trigger blog_comments_counter after insert or delete or update of is_visible on public.blog_comments for each row execute function public.sync_blog_comment_count();

alter table public.blog_posts enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_likes enable row level security;
alter table public.blog_shares enable row level security;

drop policy if exists "published blog posts are public" on public.blog_posts;
create policy "published blog posts are public" on public.blog_posts for select to anon, authenticated
using (status = 'published');
drop policy if exists "blog managers read all posts" on public.blog_posts;
create policy "blog managers read all posts" on public.blog_posts for select to authenticated
using ((select public.can_manage_blog()));
drop policy if exists "blog managers create posts" on public.blog_posts;
create policy "blog managers create posts" on public.blog_posts for insert to authenticated
with check ((select public.can_manage_blog()) and author_id = (select auth.uid()));
drop policy if exists "blog managers update posts" on public.blog_posts;
create policy "blog managers update posts" on public.blog_posts for update to authenticated
using ((select public.can_manage_blog())) with check ((select public.can_manage_blog()));
drop policy if exists "blog managers delete posts" on public.blog_posts;
create policy "blog managers delete posts" on public.blog_posts for delete to authenticated
using ((select public.can_manage_blog()));

drop policy if exists "visible comments are public" on public.blog_comments;
create policy "visible comments are public" on public.blog_comments for select to anon, authenticated
using (is_visible and exists (select 1 from public.blog_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "public can comment on published posts" on public.blog_comments;
create policy "public can comment on published posts" on public.blog_comments for insert to anon, authenticated
with check (is_visible and exists (select 1 from public.blog_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "blog managers moderate comments" on public.blog_comments;
create policy "blog managers moderate comments" on public.blog_comments for all to authenticated
using ((select public.can_manage_blog())) with check ((select public.can_manage_blog()));

drop policy if exists "public can like published posts" on public.blog_likes;
create policy "public can like published posts" on public.blog_likes for insert to anon, authenticated
with check (exists (select 1 from public.blog_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "blog managers inspect likes" on public.blog_likes;
create policy "blog managers inspect likes" on public.blog_likes for select to authenticated
using ((select public.can_manage_blog()));
drop policy if exists "blog managers remove likes" on public.blog_likes;
create policy "blog managers remove likes" on public.blog_likes for delete to authenticated
using ((select public.can_manage_blog()));

drop policy if exists "public can share published posts" on public.blog_shares;
create policy "public can share published posts" on public.blog_shares for insert to anon, authenticated
with check (exists (select 1 from public.blog_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "blog managers inspect shares" on public.blog_shares;
create policy "blog managers inspect shares" on public.blog_shares for select to authenticated
using ((select public.can_manage_blog()));
drop policy if exists "blog managers remove shares" on public.blog_shares;
create policy "blog managers remove shares" on public.blog_shares for delete to authenticated
using ((select public.can_manage_blog()));

grant select on public.blog_posts, public.blog_comments to anon, authenticated;
grant insert on public.blog_comments, public.blog_likes, public.blog_shares to anon, authenticated;
grant insert, update, delete on public.blog_posts to authenticated;
grant update, delete on public.blog_comments to authenticated;
grant select, delete on public.blog_likes, public.blog_shares to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
 ('blog-media','blog-media',true,26214400,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
 ('career-cvs','career-cvs',false,5242880,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "blog managers read media metadata" on storage.objects;
create policy "blog managers read media metadata" on storage.objects for select to authenticated
using (bucket_id = 'blog-media' and (select public.can_manage_blog()));
drop policy if exists "blog managers upload media" on storage.objects;
create policy "blog managers upload media" on storage.objects for insert to authenticated
with check (bucket_id = 'blog-media' and (select public.can_manage_blog()));
drop policy if exists "blog managers replace media" on storage.objects;
create policy "blog managers replace media" on storage.objects for update to authenticated
using (bucket_id = 'blog-media' and (select public.can_manage_blog()))
with check (bucket_id = 'blog-media' and (select public.can_manage_blog()));
drop policy if exists "blog managers delete media" on storage.objects;
create policy "blog managers delete media" on storage.objects for delete to authenticated
using (bucket_id = 'blog-media' and (select public.can_manage_blog()));

drop policy if exists "founder reads career cvs" on storage.objects;
create policy "founder reads career cvs" on storage.objects for select to authenticated
using (bucket_id = 'career-cvs' and (select public.is_super_admin()));
drop policy if exists "founder deletes career cvs" on storage.objects;
create policy "founder deletes career cvs" on storage.objects for delete to authenticated
using (bucket_id = 'career-cvs' and (select public.is_super_admin()));

alter table public.job_applications alter column email drop not null;
alter table public.job_applications add column if not exists whatsapp_number text;
alter table public.job_applications add column if not exists applicant_bio text;
alter table public.job_applications add column if not exists application_reason text;
alter table public.job_applications add column if not exists cv_storage_path text;
alter table public.job_applications add column if not exists cv_file_name text;
alter table public.job_applications add column if not exists cv_mime_type text;
alter table public.job_applications add column if not exists review_notes text;

grant insert on public.job_applications to anon, authenticated;
grant select, update on public.job_applications to authenticated;
create index if not exists job_applications_status_created_idx on public.job_applications(status, created_at desc);
