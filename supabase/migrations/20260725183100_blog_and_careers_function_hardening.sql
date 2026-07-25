create or replace function public.can_manage_blog()
returns boolean
language sql
stable
security invoker
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
revoke all on function public.can_manage_blog() from public, anon, authenticated, service_role;
grant execute on function public.can_manage_blog() to authenticated;

revoke all on function public.sync_blog_comment_count() from public, anon, authenticated, service_role;
revoke all on function public.sync_blog_like_count() from public, anon, authenticated, service_role;
revoke all on function public.sync_blog_share_count() from public, anon, authenticated, service_role;
