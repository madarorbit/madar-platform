-- Add optional pre-discount price for services.
begin;
alter table public.services
  add column if not exists compare_at_price numeric(12,2)
  check (compare_at_price is null or compare_at_price >= 0);
commit;
