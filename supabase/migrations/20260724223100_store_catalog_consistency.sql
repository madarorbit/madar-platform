begin;

alter table public.services
  add column if not exists includes jsonb not null default '[]'::jsonb;

alter table public.plans
  add column if not exists plan_type public.store_item_type not null default 'subscription';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='legacy_product_type'
  ) then
    execute $sql$
      update public.products
      set product_type = case legacy_product_type::text
        when 'template' then 'template'::public.store_item_type
        when 'subscription' then 'subscription'::public.store_item_type
        when 'service' then 'digital_product'::public.store_item_type
        else 'digital_product'::public.store_item_type
      end
      where legacy_product_type is not null
    $sql$;
  end if;
end $$;

commit;
