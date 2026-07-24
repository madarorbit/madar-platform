-- Final production hardening for the Store Engine Data API.
begin;

-- Remove every legacy read policy that could expose a draft, hidden or inactive item.
drop policy if exists "active categories anon" on public.categories;
drop policy if exists "categories authenticated read" on public.categories;
drop policy if exists "active categories public" on public.categories;
drop policy if exists "visible categories public" on public.categories;

drop policy if exists "published products anon" on public.products;
drop policy if exists "products authenticated read" on public.products;
drop policy if exists "published products public" on public.products;
drop policy if exists "visible products public" on public.products;

drop policy if exists "published services anon" on public.services;
drop policy if exists "services authenticated read" on public.services;
drop policy if exists "published services public" on public.services;
drop policy if exists "visible services public" on public.services;

drop policy if exists "published product images anon" on public.product_images;
drop policy if exists "product images authenticated read" on public.product_images;
drop policy if exists "published product images public" on public.product_images;
drop policy if exists "visible product images public" on public.product_images;

drop policy if exists "published service images anon" on public.service_images;
drop policy if exists "service images authenticated read" on public.service_images;
drop policy if exists "published service images public" on public.service_images;
drop policy if exists "visible service images public" on public.service_images;

create policy "store categories strict read"
on public.categories for select
to anon, authenticated
using (
  (is_active and visibility = 'visible' and deleted_at is null)
  or (select public.is_admin())
);

create policy "store products strict read"
on public.products for select
to anon, authenticated
using (
  (status = 'published' and visibility = 'visible' and is_active and show_in_store and deleted_at is null)
  or (select public.is_admin())
);

create policy "store services strict read"
on public.services for select
to anon, authenticated
using (
  (status = 'published' and visibility = 'visible' and is_active and show_in_store and deleted_at is null)
  or (select public.is_admin())
);

create policy "store product images strict read"
on public.product_images for select
to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and (
        (p.status = 'published' and p.visibility = 'visible' and p.is_active and p.show_in_store and p.deleted_at is null)
        or (select public.is_admin())
      )
  )
);

create policy "store service images strict read"
on public.service_images for select
to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.services s
    where s.id = service_images.service_id
      and (
        (s.status = 'published' and s.visibility = 'visible' and s.is_active and s.show_in_store and s.deleted_at is null)
        or (select public.is_admin())
      )
  )
);

-- Data API privileges are explicit; RLS remains the authorization boundary.
grant usage on schema public to anon, authenticated;

grant select on table
  public.categories,
  public.subcategories,
  public.tags,
  public.products,
  public.services,
  public.product_images,
  public.service_images,
  public.product_tags,
  public.service_tags,
  public.plan_tags,
  public.product_gallery,
  public.plans,
  public.plan_features,
  public.offers,
  public.offer_items,
  public.featured_items,
  public.store_settings
to anon, authenticated;

grant insert, update, delete on table
  public.subcategories,
  public.tags,
  public.product_tags,
  public.service_tags,
  public.plan_tags,
  public.product_gallery,
  public.plans,
  public.plan_features,
  public.offers,
  public.offer_items,
  public.featured_items,
  public.store_settings
to authenticated;

commit;
