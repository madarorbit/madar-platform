-- Preserve the legacy enum-backed column so Store Engine can own the canonical product_type field.
begin;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='product_type'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='legacy_product_type'
  ) then
    alter table public.products rename column product_type to legacy_product_type;
  end if;
end $$;
commit;
