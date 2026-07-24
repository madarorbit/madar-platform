-- Index every Store Engine foreign key used by joins, deletes and RLS checks.
begin;

create index if not exists product_tags_tag_id_idx on public.product_tags(tag_id);
create index if not exists service_tags_tag_id_idx on public.service_tags(tag_id);
create index if not exists plan_tags_tag_id_idx on public.plan_tags(tag_id);

create index if not exists products_subcategory_id_idx on public.products(subcategory_id) where deleted_at is null;
create index if not exists services_subcategory_id_idx on public.services(subcategory_id) where deleted_at is null;

create index if not exists plans_category_id_idx on public.plans(category_id) where deleted_at is null;
create index if not exists plans_subcategory_id_idx on public.plans(subcategory_id) where deleted_at is null;
create index if not exists plans_created_by_idx on public.plans(created_by) where created_by is not null;
create index if not exists plans_updated_by_idx on public.plans(updated_by) where updated_by is not null;

create index if not exists store_settings_created_by_idx on public.store_settings(created_by) where created_by is not null;
create index if not exists store_settings_updated_by_idx on public.store_settings(updated_by) where updated_by is not null;

commit;
