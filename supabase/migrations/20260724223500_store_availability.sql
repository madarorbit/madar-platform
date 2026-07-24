-- Keep the strict public rule: only Published + Visible items can be read.
-- Availability describes whether that published item is available, coming soon, sold out or disabled.
begin;

do $$ begin
 create type public.store_availability as enum ('available','coming_soon','sold_out','disabled');
exception when duplicate_object then null; end $$;

alter table public.products add column if not exists availability public.store_availability not null default 'available';
alter table public.services add column if not exists availability public.store_availability not null default 'available';
alter table public.plans add column if not exists availability public.store_availability not null default 'available';

create index if not exists products_availability_idx on public.products(availability,status,visibility,is_active) where deleted_at is null;
create index if not exists services_availability_idx on public.services(availability,status,visibility,is_active) where deleted_at is null;
create index if not exists plans_availability_idx on public.plans(availability,status,visibility,is_active) where deleted_at is null;

commit;
