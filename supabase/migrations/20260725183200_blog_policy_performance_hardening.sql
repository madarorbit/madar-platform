create index if not exists blog_posts_author_id_idx on public.blog_posts(author_id);

drop policy if exists "published blog posts are public" on public.blog_posts;
drop policy if exists "blog managers read all posts" on public.blog_posts;
create policy "published blog posts are public" on public.blog_posts for select to anon
using (status = 'published');
create policy "authenticated blog post access" on public.blog_posts for select to authenticated
using (status = 'published' or (select public.can_manage_blog()));

drop policy if exists "visible comments are public" on public.blog_comments;
drop policy if exists "blog managers moderate comments" on public.blog_comments;
create policy "visible comments are public" on public.blog_comments for select to anon
using (is_visible and exists (select 1 from public.blog_posts p where p.id = post_id and p.status = 'published'));
create policy "authenticated comment access" on public.blog_comments for select to authenticated
using ((is_visible and exists (select 1 from public.blog_posts p where p.id = post_id and p.status = 'published')) or (select public.can_manage_blog()));
create policy "blog managers update comments" on public.blog_comments for update to authenticated
using ((select public.can_manage_blog())) with check ((select public.can_manage_blog()));
create policy "blog managers delete comments" on public.blog_comments for delete to authenticated
using ((select public.can_manage_blog()));
