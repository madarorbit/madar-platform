-- Remove exposed SECURITY DEFINER entry points and consolidate overlapping policies.
alter function public.create_organization(text,text,public.organization_type) rename to create_organization_impl;
alter function public.create_organization_impl(text,text,public.organization_type) set schema private;
alter function public.manage_organization_member(uuid,text,public.organization_role,text) rename to manage_organization_member_impl;
alter function public.manage_organization_member_impl(uuid,text,public.organization_role,text) set schema private;
alter function public.list_organization_members(uuid) rename to list_organization_members_impl;
alter function public.list_organization_members_impl(uuid) set schema private;

create function public.create_organization(workspace_name text, workspace_slug text, workspace_type public.organization_type)
returns public.organizations language sql security invoker set search_path='' as $$
 select private.create_organization_impl(workspace_name,workspace_slug,workspace_type)
$$;
create function public.manage_organization_member(target_organization uuid,target_email text,requested_role public.organization_role default 'MEMBER',operation text default 'add')
returns void language sql security invoker set search_path='' as $$
 select private.manage_organization_member_impl(target_organization,target_email,requested_role,operation)
$$;
create function public.list_organization_members(target_organization uuid)
returns table(user_id uuid,email text,full_name text,role public.organization_role,created_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select * from private.list_organization_members_impl(target_organization)
$$;

revoke all on function private.create_organization_impl(text,text,public.organization_type) from public,anon;
revoke all on function private.manage_organization_member_impl(uuid,text,public.organization_role,text) from public,anon;
revoke all on function private.list_organization_members_impl(uuid) from public,anon;
grant execute on function private.create_organization_impl(text,text,public.organization_type) to authenticated;
grant execute on function private.manage_organization_member_impl(uuid,text,public.organization_role,text) to authenticated;
grant execute on function private.list_organization_members_impl(uuid) to authenticated;
revoke all on function public.create_organization(text,text,public.organization_type) from public,anon;
revoke all on function public.manage_organization_member(uuid,text,public.organization_role,text) from public,anon;
revoke all on function public.list_organization_members(uuid) from public,anon;
grant execute on function public.create_organization(text,text,public.organization_type) to authenticated;
grant execute on function public.manage_organization_member(uuid,text,public.organization_role,text) to authenticated;
grant execute on function public.list_organization_members(uuid) to authenticated;

drop policy if exists "active categories public" on public.categories;
drop policy if exists "admins categories" on public.categories;
create policy "active categories anon" on public.categories for select to anon using(is_active);
create policy "categories authenticated read" on public.categories for select to authenticated using(is_active or private.is_admin());
create policy "categories admin insert" on public.categories for insert to authenticated with check(private.is_admin());
create policy "categories admin update" on public.categories for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "categories admin delete" on public.categories for delete to authenticated using(private.is_admin());

drop policy if exists "published products public" on public.products;
drop policy if exists "admins products" on public.products;
create policy "published products anon" on public.products for select to anon using(status='published');
create policy "products authenticated read" on public.products for select to authenticated using(status='published' or private.is_admin());
create policy "products admin insert" on public.products for insert to authenticated with check(private.is_admin());
create policy "products admin update" on public.products for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "products admin delete" on public.products for delete to authenticated using(private.is_admin());

drop policy if exists "published product images public" on public.product_images;
drop policy if exists "admins product images" on public.product_images;
create policy "published product images anon" on public.product_images for select to anon using(exists(select 1 from public.products p where p.id=product_id and p.status='published'));
create policy "product images authenticated read" on public.product_images for select to authenticated using(exists(select 1 from public.products p where p.id=product_id and (p.status='published' or private.is_admin())));
create policy "product images admin insert" on public.product_images for insert to authenticated with check(private.is_admin());
create policy "product images admin update" on public.product_images for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "product images admin delete" on public.product_images for delete to authenticated using(private.is_admin());

drop policy if exists "published services public" on public.services;
drop policy if exists "admins services" on public.services;
create policy "published services anon" on public.services for select to anon using(status='published');
create policy "services authenticated read" on public.services for select to authenticated using(status='published' or private.is_admin());
create policy "services admin insert" on public.services for insert to authenticated with check(private.is_admin());
create policy "services admin update" on public.services for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "services admin delete" on public.services for delete to authenticated using(private.is_admin());

drop policy if exists "published service images public" on public.service_images;
drop policy if exists "admins service images" on public.service_images;
create policy "published service images anon" on public.service_images for select to anon using(exists(select 1 from public.services s where s.id=service_id and s.status='published'));
create policy "service images authenticated read" on public.service_images for select to authenticated using(exists(select 1 from public.services s where s.id=service_id and (s.status='published' or private.is_admin())));
create policy "service images admin insert" on public.service_images for insert to authenticated with check(private.is_admin());
create policy "service images admin update" on public.service_images for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "service images admin delete" on public.service_images for delete to authenticated using(private.is_admin());

drop policy if exists "profile self read" on public.profiles;
drop policy if exists "profile self update safe" on public.profiles;
drop policy if exists "super admin profiles" on public.profiles;
create policy "profiles authenticated read" on public.profiles for select to authenticated using((select auth.uid())=id or private.is_super_admin());
create policy "profiles authenticated update" on public.profiles for update to authenticated using((select auth.uid())=id or private.is_super_admin()) with check((select auth.uid())=id or private.is_super_admin());
create policy "profiles super admin insert" on public.profiles for insert to authenticated with check(private.is_super_admin());
create policy "profiles super admin delete" on public.profiles for delete to authenticated using(private.is_super_admin());
