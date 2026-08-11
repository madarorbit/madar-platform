-- MADAR Retail V0 — immutable operational ledgers and financial documents.

create table public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null,
  device_name text,
  platform text not null default 'web' check (platform in ('web', 'android', 'ios', 'desktop')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_seen_at timestamptz,
  last_pulled_cursor bigint not null default 0 check (last_pulled_cursor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, device_id)
);

create table public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  device_id uuid,
  operation_id uuid not null,
  operation_type text not null,
  entity_type text,
  entity_id uuid,
  status text not null default 'processing' check (status in ('processing', 'applied', 'rejected')),
  base_version bigint,
  client_created_at timestamptz,
  applied_at timestamptz,
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  error_code text,
  created_at timestamptz not null default now(),
  unique (workspace_id, operation_id)
);

create index sync_operations_workspace_created_idx
  on public.sync_operations(workspace_id, created_at desc);

create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  name text not null default 'الصندوق الرئيسي',
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  is_primary boolean not null default true,
  current_balance numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (workspace_id, id),
  foreign key (workspace_id, currency)
    references public.retail_workspaces(id, currency) on delete cascade
);

create unique index cash_accounts_one_primary_idx
  on public.cash_accounts(workspace_id)
  where is_primary;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  customer_id uuid,
  invoice_number text not null,
  status text not null default 'completed' check (status in ('completed', 'voided')),
  payment_status text not null check (payment_status in ('paid', 'partial', 'credit', 'refunded')),
  payment_method text not null check (payment_method in ('CASH', 'BANK', 'WALLET', 'CREDIT', 'OTHER')),
  subtotal numeric(18,2) not null check (subtotal >= 0),
  discount_total numeric(18,2) not null default 0 check (discount_total >= 0),
  total numeric(18,2) not null check (total >= 0),
  amount_paid numeric(18,2) not null default 0 check (amount_paid >= 0),
  returned_total numeric(18,2) not null default 0 check (returned_total >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  notes text,
  sold_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (workspace_id, id),
  unique (workspace_id, invoice_number),
  unique (workspace_id, operation_id),
  check (discount_total <= subtotal),
  check (total = subtotal - discount_total),
  check (amount_paid <= total),
  check (returned_total <= total),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete restrict,
  foreign key (workspace_id, currency)
    references public.retail_workspaces(id, currency) on delete restrict
);

create index sales_workspace_date_idx on public.sales(workspace_id, sold_at desc);
create index sales_customer_date_idx on public.sales(workspace_id, customer_id, sold_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  product_name_snapshot text not null,
  sku_snapshot text,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),
  discount_allocated numeric(18,2) not null default 0 check (discount_allocated >= 0),
  net_line_total numeric(18,2) not null check (net_line_total >= 0),
  returned_quantity numeric(18,3) not null default 0 check (returned_quantity >= 0),
  returned_refund_amount numeric(18,2) not null default 0 check (returned_refund_amount >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (line_total = round(quantity * unit_price, 2)),
  check (discount_allocated <= line_total),
  check (net_line_total = line_total - discount_allocated),
  check (returned_quantity <= quantity),
  check (returned_refund_amount <= net_line_total),
  foreign key (workspace_id, sale_id)
    references public.sales(workspace_id, id) on delete cascade,
  foreign key (workspace_id, product_id)
    references public.products(workspace_id, id) on delete restrict
);

create index sale_items_sale_idx on public.sale_items(workspace_id, sale_id);
create index sale_items_product_idx on public.sale_items(workspace_id, product_id);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  supplier_id uuid,
  purchase_number text not null,
  supplier_reference text,
  status text not null default 'completed' check (status in ('completed', 'voided')),
  payment_status text not null check (payment_status in ('paid', 'partial', 'credit')),
  payment_method text not null check (payment_method in ('CASH', 'BANK', 'WALLET', 'CREDIT', 'OTHER')),
  total numeric(18,2) not null check (total >= 0),
  amount_paid numeric(18,2) not null default 0 check (amount_paid >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  notes text,
  purchased_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (workspace_id, id),
  unique (workspace_id, purchase_number),
  unique (workspace_id, operation_id),
  check (amount_paid <= total),
  foreign key (workspace_id, supplier_id)
    references public.suppliers(workspace_id, id) on delete restrict,
  foreign key (workspace_id, currency)
    references public.retail_workspaces(id, currency) on delete restrict
);

create index purchases_workspace_date_idx on public.purchases(workspace_id, purchased_at desc);
create index purchases_supplier_date_idx on public.purchases(workspace_id, supplier_id, purchased_at desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  purchase_id uuid not null,
  product_id uuid not null,
  product_name_snapshot text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (line_total = round(quantity * unit_cost, 2)),
  foreign key (workspace_id, purchase_id)
    references public.purchases(workspace_id, id) on delete cascade,
  foreign key (workspace_id, product_id)
    references public.products(workspace_id, id) on delete restrict
);

create index purchase_items_purchase_idx on public.purchase_items(workspace_id, purchase_id);
create index purchase_items_product_idx on public.purchase_items(workspace_id, product_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 80),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  description text not null check (char_length(btrim(description)) between 1 and 240),
  payment_method text not null check (payment_method in ('CASH', 'BANK', 'WALLET', 'OTHER')),
  attachment_path text,
  expense_date date not null default current_date,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, operation_id),
  foreign key (workspace_id, currency)
    references public.retail_workspaces(id, currency) on delete restrict
);

create index expenses_workspace_date_idx on public.expenses(workspace_id, expense_date desc);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  customer_id uuid not null,
  sale_id uuid not null,
  original_amount numeric(18,2) not null check (original_amount > 0),
  balance_due numeric(18,2) not null check (balance_due >= 0),
  status text not null default 'open' check (status in ('open', 'partial', 'settled', 'written_off')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (workspace_id, id),
  unique (workspace_id, sale_id),
  check (balance_due <= original_amount),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete restrict,
  foreign key (workspace_id, sale_id)
    references public.sales(workspace_id, id) on delete restrict
);

create index receivables_open_idx on public.receivables(workspace_id, customer_id, status, created_at);

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  supplier_id uuid not null,
  purchase_id uuid not null,
  original_amount numeric(18,2) not null check (original_amount > 0),
  balance_due numeric(18,2) not null check (balance_due >= 0),
  status text not null default 'open' check (status in ('open', 'partial', 'settled', 'written_off')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (workspace_id, id),
  unique (workspace_id, purchase_id),
  check (balance_due <= original_amount),
  foreign key (workspace_id, supplier_id)
    references public.suppliers(workspace_id, id) on delete restrict,
  foreign key (workspace_id, purchase_id)
    references public.purchases(workspace_id, id) on delete restrict
);

create index payables_open_idx on public.payables(workspace_id, supplier_id, status, created_at);

create table public.debt_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  party_type text not null check (party_type in ('CUSTOMER', 'SUPPLIER')),
  customer_id uuid,
  supplier_id uuid,
  receivable_id uuid,
  payable_id uuid,
  transaction_type text not null
    check (transaction_type in ('SALE_CHARGE', 'COLLECTION', 'SALE_RETURN_CREDIT', 'PURCHASE_CHARGE', 'SUPPLIER_PAYMENT', 'ADJUSTMENT')),
  amount numeric(18,2) not null check (amount > 0),
  direction text not null check (direction in ('INCREASE', 'DECREASE')),
  balance_after numeric(18,2) not null check (balance_after >= 0),
  reference_type text not null,
  reference_id uuid not null,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (
    (party_type = 'CUSTOMER' and customer_id is not null and supplier_id is null and receivable_id is not null and payable_id is null)
    or
    (party_type = 'SUPPLIER' and supplier_id is not null and customer_id is null and payable_id is not null and receivable_id is null)
  ),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete restrict,
  foreign key (workspace_id, supplier_id)
    references public.suppliers(workspace_id, id) on delete restrict,
  foreign key (workspace_id, receivable_id)
    references public.receivables(workspace_id, id) on delete restrict,
  foreign key (workspace_id, payable_id)
    references public.payables(workspace_id, id) on delete restrict
);

create index debt_transactions_customer_idx
  on public.debt_transactions(workspace_id, customer_id, occurred_at desc);
create index debt_transactions_supplier_idx
  on public.debt_transactions(workspace_id, supplier_id, occurred_at desc);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  product_id uuid not null,
  movement_type text not null
    check (movement_type in ('OPENING', 'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'MANUAL_ADJUSTMENT', 'COUNT_ADJUSTMENT')),
  quantity_delta numeric(18,3) not null check (quantity_delta <> 0),
  balance_after numeric(18,3) not null check (balance_after >= 0),
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  reference_type text not null,
  reference_id uuid not null,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, product_id)
    references public.products(workspace_id, id) on delete restrict
);

create index inventory_movements_product_date_idx
  on public.inventory_movements(workspace_id, product_id, occurred_at desc);

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  cash_account_id uuid not null,
  direction text not null check (direction in ('IN', 'OUT')),
  transaction_type text not null
    check (transaction_type in ('OPENING', 'CASH_SALE', 'CUSTOMER_COLLECTION', 'PURCHASE_PAYMENT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'SALE_REFUND', 'MANUAL_ADJUSTMENT')),
  amount numeric(18,2) not null check (amount > 0),
  balance_after numeric(18,2) not null,
  reference_type text not null,
  reference_id uuid not null,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, cash_account_id)
    references public.cash_accounts(workspace_id, id) on delete restrict
);

create index cash_transactions_workspace_date_idx
  on public.cash_transactions(workspace_id, occurred_at desc);

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  sale_id uuid not null,
  return_number text not null,
  refund_total numeric(18,2) not null check (refund_total > 0),
  receivable_credit numeric(18,2) not null default 0 check (receivable_credit >= 0),
  cash_refund numeric(18,2) not null default 0 check (cash_refund >= 0),
  refund_method text not null check (refund_method in ('CASH', 'BANK', 'WALLET', 'OTHER')),
  reason text,
  returned_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, return_number),
  unique (workspace_id, operation_id),
  check (receivable_credit + cash_refund = refund_total),
  foreign key (workspace_id, sale_id)
    references public.sales(workspace_id, id) on delete restrict
);

create table public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  sale_return_id uuid not null,
  sale_item_id uuid not null,
  product_id uuid not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),
  refund_amount numeric(18,2) not null check (refund_amount >= 0),
  created_at timestamptz not null default now(),
  check (line_total = round(quantity * unit_price, 2)),
  foreign key (workspace_id, sale_return_id)
    references public.sale_returns(workspace_id, id) on delete cascade,
  foreign key (workspace_id, sale_item_id)
    references public.sale_items(workspace_id, id) on delete restrict,
  foreign key (workspace_id, product_id)
    references public.products(workspace_id, id) on delete restrict
);

create index sale_returns_sale_idx on public.sale_returns(workspace_id, sale_id, returned_at desc);

create trigger sync_devices_updated before update on public.sync_devices
for each row execute function private.touch_updated_at();
create trigger cash_accounts_updated before update on public.cash_accounts
for each row execute function private.touch_versioned_updated_at();
create trigger sales_updated before update on public.sales
for each row execute function private.touch_versioned_updated_at();
create trigger purchases_updated before update on public.purchases
for each row execute function private.touch_versioned_updated_at();
create trigger receivables_updated before update on public.receivables
for each row execute function private.touch_versioned_updated_at();
create trigger payables_updated before update on public.payables
for each row execute function private.touch_versioned_updated_at();
