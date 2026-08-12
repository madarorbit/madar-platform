create or replace function private.enforce_store_product_publish_readiness()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and new.visibility='visible' and new.is_active and new.show_in_store and new.deleted_at is null then
   if not exists(select 1 from public.currencies c where c.code=new.currency and c.is_active) then raise exception 'PRODUCT_CURRENCY_INACTIVE'; end if;
   if new.thumbnail_url is null or trim(new.thumbnail_url)='' then raise exception 'PRODUCT_IMAGE_REQUIRED'; end if;
   if not exists(select 1 from public.product_files f where f.product_id=new.id and f.is_active and f.deleted_at is null) then raise exception 'PRODUCT_FILE_REQUIRED'; end if;
 end if;
 return new;
end $$;
drop trigger if exists products_publish_readiness_guard on public.products;
create trigger products_publish_readiness_guard before insert or update on public.products for each row execute function private.enforce_store_product_publish_readiness();
