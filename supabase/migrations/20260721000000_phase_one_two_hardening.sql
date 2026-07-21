-- Production hardening after the manually applied phase-one baseline.
create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,full_name,email_verified)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),new.email_confirmed_at is not null)
 on conflict(id) do update set email=excluded.email,email_verified=excluded.email_verified;
 return new;
end; $$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and status='active' and role in ('ADMIN','SUPER_ADMIN'))
$$;

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and status='active' and role='SUPER_ADMIN')
$$;

create or replace function private.protect_profile_security_fields()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is not null and not private.is_super_admin()
   and (new.role is distinct from old.role or new.status is distinct from old.status)
 then raise exception 'Role and status cannot be changed by the profile owner'; end if;
 return new;
end; $$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_super_admin() from public;
revoke all on function private.protect_profile_security_fields() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_super_admin() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email,email_confirmed_at on auth.users
for each row execute function private.handle_new_user();
drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields before update on public.profiles
for each row execute function private.protect_profile_security_fields();

drop policy if exists "profile self read" on public.profiles;
drop policy if exists "profile self update safe" on public.profiles;
drop policy if exists "super admin profiles" on public.profiles;
create policy "profile self read" on public.profiles for select to authenticated using((select auth.uid())=id);
create policy "profile self update safe" on public.profiles for update to authenticated
 using((select auth.uid())=id)
 with check((select auth.uid())=id);
create policy "super admin profiles" on public.profiles for all to authenticated
 using(private.is_super_admin()) with check(private.is_super_admin());

drop policy if exists "active categories public" on public.categories;
drop policy if exists "admins categories" on public.categories;
create policy "active categories public" on public.categories for select to anon, authenticated using(is_active);
create policy "admins categories" on public.categories for all to authenticated using(private.is_admin()) with check(private.is_admin());

drop policy if exists "published products public" on public.products;
drop policy if exists "admins products" on public.products;
create policy "published products public" on public.products for select to anon, authenticated using(status='published');
create policy "admins products" on public.products for all to authenticated using(private.is_admin()) with check(private.is_admin());

drop policy if exists "published product images public" on public.product_images;
drop policy if exists "admins product images" on public.product_images;
drop policy if exists "admins product files" on public.product_files;
create policy "published product images public" on public.product_images for select to anon, authenticated
 using(exists(select 1 from public.products p where p.id=product_id and p.status='published'));
create policy "admins product images" on public.product_images for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "admins product files" on public.product_files for all to authenticated using(private.is_admin()) with check(private.is_admin());

drop policy if exists "published services public" on public.services;
drop policy if exists "admins services" on public.services;
drop policy if exists "published service images public" on public.service_images;
drop policy if exists "admins service images" on public.service_images;
create policy "published services public" on public.services for select to anon, authenticated using(status='published');
create policy "admins services" on public.services for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "published service images public" on public.service_images for select to anon, authenticated
 using(exists(select 1 from public.services s where s.id=service_id and s.status='published'));
create policy "admins service images" on public.service_images for all to authenticated using(private.is_admin()) with check(private.is_admin());

drop policy if exists "admins audit" on public.audit_logs;
drop policy if exists "admins audit writes" on public.audit_logs;
create policy "admins audit" on public.audit_logs for select to authenticated using(private.is_admin());
create policy "admins audit writes" on public.audit_logs for insert to authenticated with check(private.is_admin());

drop policy if exists "catalog public read" on storage.objects;
drop policy if exists "catalog admin write" on storage.objects;
drop policy if exists "avatar owner" on storage.objects;
drop policy if exists "digital admin only" on storage.objects;
create policy "catalog admin write" on storage.objects for all to authenticated
 using(bucket_id='catalog-images' and private.is_admin())
 with check(bucket_id='catalog-images' and private.is_admin());
create policy "avatar owner" on storage.objects for all to authenticated
 using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "digital admin only" on storage.objects for all to authenticated
 using(bucket_id='digital-products' and private.is_admin())
 with check(bucket_id='digital-products' and private.is_admin());

update storage.buckets set file_size_limit=5242880,
 allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id='catalog-images';
update storage.buckets set file_size_limit=104857600,
 allowed_mime_types=array['application/pdf','application/zip','application/x-zip-compressed','text/plain']
where id='digital-products';
update storage.buckets set file_size_limit=5242880,
 allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id='avatars';

create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists product_files_created_by_idx on public.product_files(created_by);
create index if not exists product_files_product_id_idx on public.product_files(product_id);
create index if not exists product_images_product_id_idx on public.product_images(product_id);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_created_by_idx on public.products(created_by);
create index if not exists products_updated_by_idx on public.products(updated_by);
create index if not exists service_images_service_id_idx on public.service_images(service_id);
create index if not exists services_created_by_idx on public.services(created_by);
create index if not exists services_updated_by_idx on public.services(updated_by);

revoke all on public.profiles,public.categories,public.products,public.product_images,public.product_files,
 public.services,public.service_images,public.audit_logs from anon,authenticated;
grant select on public.categories,public.products,public.product_images,public.services,public.service_images to anon;
grant select,insert,update,delete on public.profiles,public.categories,public.products,public.product_images,
 public.product_files,public.services,public.service_images,public.audit_logs to authenticated;
grant all on public.profiles,public.categories,public.products,public.product_images,public.product_files,
 public.services,public.service_images,public.audit_logs to service_role;

revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.is_admin() from public,anon,authenticated;
revoke all on function public.is_super_admin() from public,anon,authenticated;
revoke all on function public.touch_updated_at() from public,anon,authenticated;
