-- MADAR Retail V0 — isolated product foundation.
-- This migration is intentionally independent from madar-platform.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

create or replace function private.touch_versioned_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

revoke all on function private.touch_versioned_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  platform_role text not null default 'CUSTOMER'
    check (platform_role in ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN')),
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  active_workspace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_status_idx on public.profiles(platform_role, status);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, email, full_name)
  values(
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), '')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function private.handle_new_user();

create table public.retail_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,78}[a-z0-9]$'),
  domain_model text not null default 'RETAIL' check (domain_model = 'RETAIL'),
  subtype text not null default 'GENERAL_RETAIL'
    check (subtype in ('CLOTHING', 'PERFUME', 'GROCERY', 'ELECTRONICS', 'ACCESSORIES', 'SPARE_PARTS', 'GENERAL_RETAIL', 'OTHER')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  owner_name text,
  phone text,
  city text,
  country text not null default 'YE',
  currency text not null default 'YER' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Aden',
  logo_path text,
  price_display text not null default 'simple'
    check (price_display in ('simple', 'tax_inclusive')),
  inventory_policy text not null default 'prevent_negative'
    check (inventory_policy = 'prevent_negative'),
  allow_credit_sales boolean not null default true,
  invoice_prefix text not null default 'MR'
    check (invoice_prefix ~ '^[A-Z0-9-]{1,8}$'),
  next_sale_number bigint not null default 1 check (next_sale_number > 0),
  next_purchase_number bigint not null default 1 check (next_purchase_number > 0),
  onboarding_completed_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (id, currency)
);

alter table public.profiles
  add constraint profiles_active_workspace_fk
  foreign key (active_workspace_id) references public.retail_workspaces(id) on delete set null;

create table public.workspace_members (
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'STAFF'
    check (role in ('OWNER', 'MANAGER', 'STAFF', 'VIEWER')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id, status);

create table public.onboarding_drafts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reserved_workspace_id uuid not null default gen_random_uuid() unique,
  current_step smallint not null default 1 check (current_step between 1 and 5),
  trade_name text,
  owner_name text,
  phone text,
  city text,
  country text not null default 'YE',
  currency text not null default 'YER' check (currency ~ '^[A-Z]{3}$'),
  logo_path text,
  subtype text check (subtype is null or subtype in ('CLOTHING', 'PERFUME', 'GROCERY', 'ELECTRONICS', 'ACCESSORIES', 'SPARE_PARTS', 'GENERAL_RETAIL', 'OTHER')),
  price_display text not null default 'simple' check (price_display in ('simple', 'tax_inclusive')),
  inventory_policy text not null default 'prevent_negative' check (inventory_policy = 'prevent_negative'),
  allow_credit_sales boolean not null default true,
  invoice_prefix text not null default 'MR' check (invoice_prefix ~ '^[A-Z0-9-]{1,8}$'),
  selected_plan_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{3,60}$'),
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 100),
  description_ar text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  is_public boolean not null default false,
  price_amount numeric(18,2) check (price_amount is null or price_amount >= 0),
  currency text not null default 'YER' check (currency ~ '^[A-Z]{3}$'),
  billing_months integer check (billing_months is null or billing_months between 1 and 36),
  trial_days integer not null default 0 check (trial_days between 0 and 90),
  grace_days integer not null default 0 check (grace_days between 0 and 30),
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

alter table public.onboarding_drafts
  add constraint onboarding_drafts_plan_fk
  foreign key (selected_plan_id) references public.plans(id) on delete set null;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'grace', 'expired', 'suspended', 'cancelled')),
  starts_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  ends_at timestamptz,
  grace_ends_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (workspace_id)
);

create index subscriptions_status_end_idx on public.subscriptions(status, ends_at);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,60}$'),
  name_ar text not null,
  kind text not null check (kind in ('LOCAL_WALLET', 'BANK_TRANSFER', 'MANUAL')),
  account_name text,
  account_identifier text,
  instructions_ar text,
  currency text not null default 'YER' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'disabled')),
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id uuid not null references public.plans(id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  payment_reference text not null check (char_length(btrim(payment_reference)) between 3 and 120),
  proof_path text not null,
  proof_filename text not null,
  proof_mime_type text not null check (proof_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  proof_size_bytes bigint not null check (proof_size_bytes between 1 and 10485760),
  status text not null default 'under_review'
    check (status in ('under_review', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create unique index payment_requests_one_pending_idx
  on public.payment_requests(workspace_id)
  where status = 'under_review';
create index payment_requests_review_queue_idx
  on public.payment_requests(status, created_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.retail_workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_logs_workspace_created_idx on public.audit_logs(workspace_id, created_at desc);
create index audit_logs_action_created_idx on public.audit_logs(action, created_at desc);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  color text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (workspace_id, id)
);

create unique index categories_workspace_name_unique
  on public.categories(workspace_id, lower(name))
  where deleted_at is null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  category_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  sku text,
  barcode text,
  purchase_price numeric(18,2) not null default 0 check (purchase_price >= 0),
  average_cost numeric(18,4) not null default 0 check (average_cost >= 0),
  sale_price numeric(18,2) not null default 0 check (sale_price >= 0),
  stock_on_hand numeric(18,3) not null default 0 check (stock_on_hand >= 0),
  minimum_stock numeric(18,3) not null default 0 check (minimum_stock >= 0),
  unit text not null default 'قطعة' check (char_length(btrim(unit)) between 1 and 30),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  image_path text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, category_id)
    references public.categories(workspace_id, id) on delete restrict
);

create unique index products_workspace_sku_unique
  on public.products(workspace_id, lower(sku))
  where sku is not null and btrim(sku) <> '' and deleted_at is null;
create unique index products_workspace_barcode_unique
  on public.products(workspace_id, barcode)
  where barcode is not null and btrim(barcode) <> '' and deleted_at is null;
create index products_workspace_active_idx on public.products(workspace_id, status, name)
  where deleted_at is null;
create index products_low_stock_idx on public.products(workspace_id, stock_on_hand, minimum_stock)
  where status = 'active' and deleted_at is null;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  phone text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (workspace_id, id)
);

create index customers_workspace_name_idx on public.customers(workspace_id, name)
  where deleted_at is null;
create index customers_workspace_phone_idx on public.customers(workspace_id, phone)
  where phone is not null and deleted_at is null;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  phone text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (workspace_id, id)
);

create index suppliers_workspace_name_idx on public.suppliers(workspace_id, name)
  where deleted_at is null;

create trigger profiles_updated before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger retail_workspaces_updated before update on public.retail_workspaces
for each row execute function private.touch_versioned_updated_at();
create trigger workspace_members_updated before update on public.workspace_members
for each row execute function private.touch_updated_at();
create trigger onboarding_drafts_updated before update on public.onboarding_drafts
for each row execute function private.touch_updated_at();
create trigger plans_updated before update on public.plans
for each row execute function private.touch_versioned_updated_at();
create trigger subscriptions_updated before update on public.subscriptions
for each row execute function private.touch_versioned_updated_at();
create trigger payment_methods_updated before update on public.payment_methods
for each row execute function private.touch_versioned_updated_at();
create trigger payment_requests_updated before update on public.payment_requests
for each row execute function private.touch_versioned_updated_at();
create trigger categories_updated before update on public.categories
for each row execute function private.touch_versioned_updated_at();
create trigger products_updated before update on public.products
for each row execute function private.touch_versioned_updated_at();
create trigger customers_updated before update on public.customers
for each row execute function private.touch_versioned_updated_at();
create trigger suppliers_updated before update on public.suppliers
for each row execute function private.touch_versioned_updated_at();

insert into public.plans(
  code, name_ar, description_ar, status, is_public, price_amount,
  currency, billing_months, trial_days, grace_days, features, limits
)
values (
  'RETAIL_V0_TRIAL',
  'تجربة MADAR Retail V0',
  'خطة تجريبية قابلة للتعديل من إدارة MADAR Retail. ليست سعرًا تجاريًا نهائيًا.',
  'active',
  true,
  null,
  'YER',
  null,
  20,
  0,
  '{"dashboard":true,"analytics":true,"orby_read_only":true,"sync_api":true}'::jsonb,
  '{"members":1,"products":500,"orby_daily_requests":30}'::jsonb
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('workspace-assets', 'workspace-assets', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('product-images', 'product-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
