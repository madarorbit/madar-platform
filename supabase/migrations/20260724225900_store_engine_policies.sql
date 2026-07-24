-- RLS and updated_at policies for Store Engine tables created by this phase.
begin;

-- Keep timestamps reliable on every mutable Store Engine table.
drop trigger if exists subcategories_updated on public.subcategories;
create trigger subcategories_updated before update on public.subcategories for each row execute function public.touch_updated_at();
drop trigger if exists tags_updated on public.tags;
create trigger tags_updated before update on public.tags for each row execute function public.touch_updated_at();
drop trigger if exists product_images_updated on public.product_images;
create trigger product_images_updated before update on public.product_images for each row execute function public.touch_updated_at();
drop trigger if exists product_files_updated on public.product_files;
create trigger product_files_updated before update on public.product_files for each row execute function public.touch_updated_at();
drop trigger if exists service_images_updated on public.service_images;
create trigger service_images_updated before update on public.service_images for each row execute function public.touch_updated_at();
drop trigger if exists product_gallery_updated on public.product_gallery;
create trigger product_gallery_updated before update on public.product_gallery for each row execute function public.touch_updated_at();
drop trigger if exists plans_updated on public.plans;
create trigger plans_updated before update on public.plans for each row execute function public.touch_updated_at();
drop trigger if exists plan_features_updated on public.plan_features;
create trigger plan_features_updated before update on public.plan_features for each row execute function public.touch_updated_at();
drop trigger if exists offers_updated on public.offers;
create trigger offers_updated before update on public.offers for each row execute function public.touch_updated_at();
drop trigger if exists featured_items_updated on public.featured_items;
create trigger featured_items_updated before update on public.featured_items for each row execute function public.touch_updated_at();
drop trigger if exists store_settings_updated on public.store_settings;
create trigger store_settings_updated before update on public.store_settings for each row execute function public.touch_updated_at();

alter table public.subcategories enable row level security;
alter table public.tags enable row level security;
alter table public.product_tags enable row level security;
alter table public.service_tags enable row level security;
alter table public.plan_tags enable row level security;
alter table public.product_gallery enable row level security;
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.offers enable row level security;
alter table public.offer_items enable row level security;
alter table public.featured_items enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "visible subcategories public" on public.subcategories;
drop policy if exists "admins subcategories" on public.subcategories;
create policy "visible subcategories public" on public.subcategories for select to anon, authenticated
using ((is_active and visibility='visible' and deleted_at is null) or (select public.is_admin()));
create policy "admins subcategories" on public.subcategories for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible tags public" on public.tags;
drop policy if exists "admins tags" on public.tags;
create policy "visible tags public" on public.tags for select to anon, authenticated
using ((is_active and deleted_at is null) or (select public.is_admin()));
create policy "admins tags" on public.tags for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible product tags public" on public.product_tags;
drop policy if exists "admins product tags" on public.product_tags;
create policy "visible product tags public" on public.product_tags for select to anon, authenticated
using (exists (
  select 1 from public.products p
  where p.id=product_id and p.status='published' and p.visibility='visible'
    and p.is_active and p.show_in_store and p.deleted_at is null
) or (select public.is_admin()));
create policy "admins product tags" on public.product_tags for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible service tags public" on public.service_tags;
drop policy if exists "admins service tags" on public.service_tags;
create policy "visible service tags public" on public.service_tags for select to anon, authenticated
using (exists (
  select 1 from public.services s
  where s.id=service_id and s.status='published' and s.visibility='visible'
    and s.is_active and s.show_in_store and s.deleted_at is null
) or (select public.is_admin()));
create policy "admins service tags" on public.service_tags for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible plan tags public" on public.plan_tags;
drop policy if exists "admins plan tags" on public.plan_tags;
create policy "visible plan tags public" on public.plan_tags for select to anon, authenticated
using (exists (
  select 1 from public.plans p
  where p.id=plan_id and p.status='published' and p.visibility='visible'
    and p.is_active and p.show_in_store and p.deleted_at is null
) or (select public.is_admin()));
create policy "admins plan tags" on public.plan_tags for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible gallery public" on public.product_gallery;
drop policy if exists "admins gallery" on public.product_gallery;
create policy "visible gallery public" on public.product_gallery for select to anon, authenticated
using (deleted_at is null and (
  exists (
    select 1 from public.products p
    where p.id=product_id and p.status='published' and p.visibility='visible'
      and p.is_active and p.show_in_store and p.deleted_at is null
  ) or (select public.is_admin())
));
create policy "admins gallery" on public.product_gallery for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible plans public" on public.plans;
drop policy if exists "admins plans" on public.plans;
create policy "visible plans public" on public.plans for select to anon, authenticated
using ((status='published' and visibility='visible' and is_active and show_in_store and deleted_at is null)
  or (select public.is_admin()));
create policy "admins plans" on public.plans for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible plan features public" on public.plan_features;
drop policy if exists "admins plan features" on public.plan_features;
create policy "visible plan features public" on public.plan_features for select to anon, authenticated
using (deleted_at is null and (
  exists (
    select 1 from public.plans p
    where p.id=plan_id and p.status='published' and p.visibility='visible'
      and p.is_active and p.show_in_store and p.deleted_at is null
  ) or (select public.is_admin())
));
create policy "admins plan features" on public.plan_features for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible offers public" on public.offers;
drop policy if exists "admins offers" on public.offers;
create policy "visible offers public" on public.offers for select to anon, authenticated
using ((status='published' and visibility='visible' and is_active and deleted_at is null
  and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()))
  or (select public.is_admin()));
create policy "admins offers" on public.offers for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible offer items public" on public.offer_items;
drop policy if exists "admins offer items" on public.offer_items;
create policy "visible offer items public" on public.offer_items for select to anon, authenticated
using (exists (
  select 1 from public.offers o
  where o.id=offer_id and o.status='published' and o.visibility='visible'
    and o.is_active and o.deleted_at is null
) or (select public.is_admin()));
create policy "admins offer items" on public.offer_items for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "visible featured public" on public.featured_items;
drop policy if exists "admins featured" on public.featured_items;
create policy "visible featured public" on public.featured_items for select to anon, authenticated
using ((is_active and deleted_at is null
  and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()))
  or (select public.is_admin()));
create policy "admins featured" on public.featured_items for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "public store settings" on public.store_settings;
drop policy if exists "admins store settings" on public.store_settings;
create policy "public store settings" on public.store_settings for select to anon, authenticated
using ((is_public and deleted_at is null) or (select public.is_admin()));
create policy "admins store settings" on public.store_settings for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

commit;
