-- Preserve the public state of catalog records that were already published before Store Engine.
-- Seed rows are inserted later as draft/hidden/inactive and are not affected.
begin;

update public.categories
set visibility = 'visible'
where is_active = true
  and deleted_at is null;

update public.products
set visibility = 'visible',
    is_active = true,
    show_in_store = true
where status = 'published'
  and deleted_at is null;

update public.services
set visibility = 'visible',
    is_active = true,
    show_in_store = true
where status = 'published'
  and deleted_at is null;

commit;
