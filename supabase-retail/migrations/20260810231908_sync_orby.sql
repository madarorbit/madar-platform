-- MADAR Retail V0 — Android-ready change feed and read-only ORBY history.

create table public.sync_changes (
  cursor bigint generated always as identity primary key,
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null default 'UPSERT' check (operation in ('UPSERT', 'DELETE')),
  row_version bigint,
  payload jsonb not null,
  changed_at timestamptz not null default now()
);

create index sync_changes_workspace_cursor_idx
  on public.sync_changes(workspace_id, cursor);

create or replace function private.capture_sync_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_workspace uuid := (row_data->>'workspace_id')::uuid;
  target_id uuid := (row_data->>'id')::uuid;
begin
  insert into public.sync_changes(
    workspace_id, entity_type, entity_id, operation, row_version, payload
  ) values (
    target_workspace,
    tg_table_name,
    target_id,
    case when tg_op = 'DELETE' then 'DELETE' else 'UPSERT' end,
    nullif(row_data->>'version', '')::bigint,
    row_data
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.capture_sync_change() from public, anon, authenticated;

create trigger sync_categories_change after insert or update or delete on public.categories
for each row execute function private.capture_sync_change();
create trigger sync_products_change after insert or update or delete on public.products
for each row execute function private.capture_sync_change();
create trigger sync_customers_change after insert or update or delete on public.customers
for each row execute function private.capture_sync_change();
create trigger sync_suppliers_change after insert or update or delete on public.suppliers
for each row execute function private.capture_sync_change();
create trigger sync_cash_accounts_change after insert or update or delete on public.cash_accounts
for each row execute function private.capture_sync_change();
create trigger sync_sales_change after insert or update or delete on public.sales
for each row execute function private.capture_sync_change();
create trigger sync_sale_items_change after insert or update or delete on public.sale_items
for each row execute function private.capture_sync_change();
create trigger sync_purchases_change after insert or update or delete on public.purchases
for each row execute function private.capture_sync_change();
create trigger sync_purchase_items_change after insert or update or delete on public.purchase_items
for each row execute function private.capture_sync_change();
create trigger sync_expenses_change after insert or update or delete on public.expenses
for each row execute function private.capture_sync_change();
create trigger sync_receivables_change after insert or update or delete on public.receivables
for each row execute function private.capture_sync_change();
create trigger sync_payables_change after insert or update or delete on public.payables
for each row execute function private.capture_sync_change();
create trigger sync_debt_transactions_change after insert or update or delete on public.debt_transactions
for each row execute function private.capture_sync_change();
create trigger sync_inventory_movements_change after insert or update or delete on public.inventory_movements
for each row execute function private.capture_sync_change();
create trigger sync_cash_transactions_change after insert or update or delete on public.cash_transactions
for each row execute function private.capture_sync_change();
create trigger sync_sale_returns_change after insert or update or delete on public.sale_returns
for each row execute function private.capture_sync_change();
create trigger sync_sale_return_items_change after insert or update or delete on public.sale_return_items
for each row execute function private.capture_sync_change();

create table public.orby_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  title text not null default 'محادثة جديدة' check (char_length(title) between 1 and 120),
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create index orby_conversations_workspace_idx
  on public.orby_conversations(workspace_id, updated_at desc);

create table public.orby_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  status text not null default 'complete' check (status in ('complete', 'error')),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  provider text,
  model text,
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, conversation_id)
    references public.orby_conversations(workspace_id, id) on delete cascade
);

create index orby_messages_conversation_idx
  on public.orby_messages(workspace_id, conversation_id, created_at);

create table public.orby_usage_daily (
  workspace_id uuid not null references public.retail_workspaces(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, usage_date)
);

create trigger orby_conversations_updated before update on public.orby_conversations
for each row execute function private.touch_updated_at();

create or replace function public.register_retail_sync_device(
  target_workspace uuid,
  target_device uuid,
  device_name text,
  platform_name text,
  app_version_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_membership_actor(target_workspace);
  record_id uuid;
begin
  if target_device is null then raise exception 'DEVICE_ID_REQUIRED'; end if;
  if char_length(btrim(coalesce(device_name, ''))) not between 1 and 80 then raise exception 'INVALID_DEVICE_NAME'; end if;
  if lower(coalesce(platform_name, '')) not in ('android', 'web') then raise exception 'INVALID_DEVICE_PLATFORM'; end if;

  insert into public.sync_devices(
    workspace_id, user_id, device_id, device_name, platform, app_version, status,
    last_seen_at, last_pulled_cursor
  ) values (
    target_workspace, actor, target_device, btrim(device_name), lower(platform_name),
    nullif(btrim(app_version_value), ''), 'active', now(), 0
  )
  on conflict (workspace_id, device_id) do update
  set device_name = excluded.device_name,
      platform = excluded.platform,
      app_version = excluded.app_version,
      status = 'active',
      last_seen_at = now()
  where sync_devices.user_id = actor
  returning id into record_id;

  if record_id is null then raise exception 'DEVICE_ID_CONFLICT'; end if;

  return jsonb_build_object(
    'registration_id', record_id,
    'device_id', target_device,
    'workspace_id', target_workspace,
    'server_time', now()
  );
end;
$$;

revoke all on function public.register_retail_sync_device(uuid, uuid, text, text, text) from public, anon, authenticated;

create or replace function public.pull_retail_sync_changes(
  target_workspace uuid,
  target_device uuid,
  after_cursor bigint default 0,
  page_size integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_membership_actor(target_workspace, array['OWNER', 'MANAGER', 'STAFF', 'VIEWER']::text[]);
  safe_limit integer := least(greatest(coalesce(page_size, 250), 1), 500);
  result jsonb;
  next_cursor bigint;
begin
  if after_cursor < 0 then raise exception 'INVALID_SYNC_CURSOR'; end if;
  if not exists (
    select 1 from public.sync_devices
    where device_id = target_device and workspace_id = target_workspace
      and user_id = actor and status = 'active'
  ) then raise exception 'DEVICE_NOT_REGISTERED'; end if;

  with page as (
    select cursor, entity_type, entity_id, operation, row_version, payload, changed_at
    from public.sync_changes
    where workspace_id = target_workspace and cursor > after_cursor
    order by cursor
    limit safe_limit
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by cursor), '[]'::jsonb),
         coalesce(max(cursor), after_cursor)
  into result, next_cursor
  from page;

  update public.sync_devices
  set last_seen_at = now(), last_pulled_cursor = greatest(last_pulled_cursor, next_cursor)
  where device_id = target_device and workspace_id = target_workspace and user_id = actor;

  return jsonb_build_object(
    'after_cursor', after_cursor,
    'next_cursor', next_cursor,
    'has_more', exists (
      select 1 from public.sync_changes
      where workspace_id = target_workspace and cursor > next_cursor
    ),
    'changes', result,
    'server_time', now()
  );
end;
$$;

revoke all on function public.pull_retail_sync_changes(uuid, uuid, bigint, integer) from public, anon, authenticated;
