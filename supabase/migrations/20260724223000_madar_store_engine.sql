-- MADAR Store Engine core schema.
-- Seed data, policies and production hardening are versioned in subsequent migrations.
begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$ begin
  create type public.store_visibility as enum ('visible','hidden');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_item_type as enum ('digital_product','ready_system','service','subscription','bundle','template','student_resource');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_delivery_type as enum ('instant_download','manual_delivery','external_link','account_activation','scheduled_service');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.catalog_status add value if not exists 'coming_soon';
  alter type public.catalog_status add value if not exists 'sold_out';
  alter type public.catalog_status add value if not exists 'disabled';
exception when duplicate_object then null; end $$;

alter table public.categories
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists visibility public.store_visibility not null default 'hidden',
  add column if not exists deleted_at timestamptz;

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  seo_title text,
  seo_description text,
  visibility public.store_visibility not null default 'hidden',
  is_active boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id,name)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null,
  add column if not exists product_type public.store_item_type not null default 'digital_product',
  add column if not exists visibility public.store_visibility not null default 'hidden',
  add column if not exists is_active boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists view_count bigint not null default 0,
  add column if not exists sales_count bigint not null default 0,
  add column if not exists rating_average numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0,
  add column if not exists video_url text,
  add column if not exists external_url text,
  add column if not exists purchase_url text,
  add column if not exists keywords text[] not null default '{}',
  add column if not exists delivery_duration text,
  add column if not exists requires_approval boolean not null default false,
  add column if not exists is_free boolean not null default false,
  add column if not exists show_in_store boolean not null default false,
  add column if not exists show_on_home boolean not null default false,
  add column if not exists allow_reviews boolean not null default true,
  add column if not exists allow_comments boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.services
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null,
  add column if not exists service_type public.store_item_type not null default 'service',
  add column if not exists visibility public.store_visibility not null default 'hidden',
  add column if not exists is_active boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists view_count bigint not null default 0,
  add column if not exists sales_count bigint not null default 0,
  add column if not exists rating_average numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0,
  add column if not exists video_url text,
  add column if not exists external_url text,
  add column if not exists purchase_url text,
  add column if not exists keywords text[] not null default '{}',
  add column if not exists delivery_duration text,
  add column if not exists delivery_type public.store_delivery_type not null default 'scheduled_service',
  add column if not exists requires_approval boolean not null default true,
  add column if not exists is_free boolean not null default false,
  add column if not exists show_in_store boolean not null default false,
  add column if not exists show_on_home boolean not null default false,
  add column if not exists allow_reviews boolean not null default true,
  add column if not exists allow_comments boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.product_images
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.product_files
  add column if not exists title text,
  add column if not exists file_kind text not null default 'download',
  add column if not exists is_public boolean not null default false,
  add column if not exists download_limit integer,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.service_images
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

create table if not exists public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(product_id,tag_id)
);

create table if not exists public.service_tags (
  service_id uuid not null references public.services(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(service_id,tag_id)
);

create table if not exists public.product_gallery (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null default 'image' check(media_type in ('image','video')),
  storage_path text,
  external_url text,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(storage_path is not null or external_url is not null)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  long_description text,
  price numeric(12,2) not null default 0 check(price>=0),
  compare_at_price numeric(12,2) check(compare_at_price is null or compare_at_price>=0),
  currency text not null default 'SAR',
  billing_interval text not null default 'monthly' check(billing_interval in ('one_time','monthly','quarterly','yearly')),
  trial_days integer not null default 0 check(trial_days>=0),
  status public.catalog_status not null default 'draft',
  visibility public.store_visibility not null default 'hidden',
  is_active boolean not null default false,
  is_featured boolean not null default false,
  show_in_store boolean not null default false,
  show_on_home boolean not null default false,
  requires_approval boolean not null default true,
  sort_order integer not null default 0,
  max_workspaces integer,
  max_users integer,
  seo_title text,
  seo_description text,
  keywords text[] not null default '{}',
  purchase_url text,
  published_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  name text not null,
  description text,
  feature_key text,
  value jsonb not null default 'true'::jsonb,
  is_highlighted boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  discount_type text not null default 'percentage' check(discount_type in ('percentage','fixed','override_price')),
  discount_value numeric(12,2) not null default 0 check(discount_value>=0),
  starts_at timestamptz,
  ends_at timestamptz,
  status public.catalog_status not null default 'draft',
  visibility public.store_visibility not null default 'hidden',
  is_active boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer_items (
  offer_id uuid not null references public.offers(id) on delete cascade,
  entity_type text not null check(entity_type in ('product','service','plan')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(offer_id,entity_type,entity_id)
);

create table if not exists public.featured_items (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check(entity_type in ('product','service','plan','category')),
  entity_id uuid not null,
  placement text not null default 'store' check(placement in ('store','home','offers','category')),
  title_override text,
  subtitle_override text,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type,entity_id,placement)
);

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcategories_category_active_idx on public.subcategories(category_id,is_active,sort_order) where deleted_at is null;
create index if not exists tags_active_name_idx on public.tags(is_active,name) where deleted_at is null;
create index if not exists products_store_listing_idx on public.products(status,visibility,is_active,show_in_store,sort_order,published_at desc) where deleted_at is null;
create index if not exists products_store_category_idx on public.products(category_id,subcategory_id,status,visibility) where deleted_at is null;
create index if not exists products_store_sales_idx on public.products(sales_count desc,rating_average desc) where deleted_at is null;
create index if not exists services_store_listing_idx on public.services(status,visibility,is_active,show_in_store,sort_order,published_at desc) where deleted_at is null;
create index if not exists services_store_category_idx on public.services(category_id,subcategory_id,status,visibility) where deleted_at is null;
create index if not exists plans_store_listing_idx on public.plans(status,visibility,is_active,sort_order,published_at desc) where deleted_at is null;
create index if not exists product_gallery_product_idx on public.product_gallery(product_id,sort_order) where deleted_at is null;
create index if not exists plan_features_plan_idx on public.plan_features(plan_id,sort_order) where deleted_at is null;
create index if not exists offers_active_window_idx on public.offers(is_active,starts_at,ends_at) where deleted_at is null;
create index if not exists featured_items_placement_idx on public.featured_items(placement,is_active,sort_order) where deleted_at is null;
create index if not exists store_settings_public_idx on public.store_settings(is_public,setting_key) where deleted_at is null;
create index if not exists products_name_trgm_idx on public.products using gin(name gin_trgm_ops);
create index if not exists products_short_description_trgm_idx on public.products using gin(short_description gin_trgm_ops);
create index if not exists products_seo_title_trgm_idx on public.products using gin(seo_title gin_trgm_ops);
create index if not exists services_name_trgm_idx on public.services using gin(name gin_trgm_ops);
create index if not exists services_short_description_trgm_idx on public.services using gin(short_description gin_trgm_ops);
create index if not exists services_seo_title_trgm_idx on public.services using gin(seo_title gin_trgm_ops);

commit;
