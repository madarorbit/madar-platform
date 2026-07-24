begin;

alter table public.services
  add column if not exists includes jsonb not null default '[]'::jsonb;

alter table public.plans
  add column if not exists plan_type public.store_item_type not null default 'subscription';

update public.products
set product_type = case legacy_product_type::text
  when 'template' then 'template'::public.store_item_type
  when 'subscription' then 'subscription'::public.store_item_type
  when 'service' then 'digital_product'::public.store_item_type
  else 'digital_product'::public.store_item_type
end
where legacy_product_type is not null;

commit;
