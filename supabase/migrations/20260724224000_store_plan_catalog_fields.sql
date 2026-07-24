-- Align subscription plans with the common Store Engine catalog contract.
begin;

alter table public.plans
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null,
  add column if not exists thumbnail_url text,
  add column if not exists video_url text,
  add column if not exists external_url text,
  add column if not exists delivery_type public.store_delivery_type not null default 'account_activation',
  add column if not exists delivery_duration text,
  add column if not exists is_free boolean not null default false,
  add column if not exists rating_average numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0,
  add column if not exists sales_count bigint not null default 0,
  add column if not exists view_count bigint not null default 0,
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists includes jsonb not null default '[]'::jsonb;

create index if not exists plans_category_idx on public.plans(category_id,subcategory_id,status,visibility) where deleted_at is null;
create index if not exists plans_sales_rating_idx on public.plans(sales_count desc,rating_average desc) where deleted_at is null;

insert into public.categories(name,slug,description,is_active,visibility,sort_order)
values ('الاشتراكات والباقات','subscriptions-plans','اشتراكات وباقات مَدار القابلة للتفعيل من لوحة الإدارة.',false,'hidden',70)
on conflict(slug) do nothing;

commit;
