-- MADAR Retail V0 — authorization, onboarding, inventory and cash operations.

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'active'
      and platform_role in ('ADMIN', 'SUPER_ADMIN')
  )
$$;

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = (select auth.uid())
      and status = 'active'
  )
$$;

create or replace function private.has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = (select auth.uid())
      and status = 'active'
      and role = any(allowed_roles)
  )
$$;

revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.is_workspace_member(uuid) from public, anon, authenticated;
revoke all on function private.has_workspace_role(uuid, text[]) from public, anon, authenticated;

create or replace function private.require_membership_actor(
  target_workspace uuid,
  allowed_roles text[] default array['OWNER', 'MANAGER', 'STAFF']::text[]
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); workspace_status text;
begin
  if actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = actor and status = 'active') then
    raise exception 'ACCOUNT_DISABLED';
  end if;
  if not private.has_workspace_role(target_workspace, allowed_roles) then raise exception 'NOT_AUTHORIZED'; end if;
  select status into workspace_status from public.retail_workspaces where id = target_workspace;
  if workspace_status is null then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  if workspace_status = 'archived' then raise exception 'WORKSPACE_ARCHIVED'; end if;
  return actor;
end;
$$;

revoke all on function private.require_membership_actor(uuid, text[]) from public, anon, authenticated;

create or replace function private.require_workspace_actor(
  target_workspace uuid,
  allowed_roles text[] default array['OWNER', 'MANAGER', 'STAFF']::text[]
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_membership_actor(target_workspace, allowed_roles);
  workspace_status text;
  subscription public.subscriptions%rowtype;
begin
  select status into workspace_status
  from public.retail_workspaces
  where id = target_workspace;
  if workspace_status is null then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  if workspace_status <> 'active' then raise exception 'WORKSPACE_SUSPENDED'; end if;

  select * into subscription
  from public.subscriptions
  where workspace_id = target_workspace;
  if subscription.id is null then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  if subscription.status in ('suspended', 'cancelled', 'expired') then
    raise exception 'SUBSCRIPTION_INACTIVE';
  end if;
  if subscription.status = 'trialing'
    and subscription.trial_ends_at is not null
    and now() > subscription.trial_ends_at then
    raise exception 'SUBSCRIPTION_EXPIRED';
  end if;
  if subscription.status = 'active'
    and subscription.ends_at is not null
    and now() > subscription.ends_at then
    raise exception 'SUBSCRIPTION_EXPIRED';
  end if;
  if subscription.status = 'grace'
    and subscription.grace_ends_at is not null
    and now() > subscription.grace_ends_at then
    raise exception 'SUBSCRIPTION_EXPIRED';
  end if;
  return actor;
end;
$$;

revoke all on function private.require_workspace_actor(uuid, text[]) from public, anon, authenticated;

create or replace function private.begin_operation(
  target_workspace uuid,
  actor uuid,
  target_operation uuid,
  target_type text,
  source_device uuid default null,
  client_time timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare existing public.sync_operations%rowtype;
begin
  if target_operation is null then raise exception 'OPERATION_ID_REQUIRED'; end if;
  if source_device is not null and not exists (
    select 1 from public.sync_devices
    where workspace_id = target_workspace and device_id = source_device
      and user_id = actor and status = 'active'
  ) then raise exception 'DEVICE_NOT_REGISTERED'; end if;
  select * into existing
  from public.sync_operations
  where workspace_id = target_workspace and operation_id = target_operation
  for update;

  if existing.id is not null then
    if existing.operation_type <> target_type then raise exception 'OPERATION_ID_CONFLICT'; end if;
    if existing.status = 'applied' then return existing.result; end if;
    raise exception 'OPERATION_ALREADY_PROCESSING';
  end if;

  insert into public.sync_operations(
    workspace_id, user_id, device_id, operation_id, operation_type,
    status, client_created_at
  ) values (
    target_workspace, actor, source_device, target_operation, target_type,
    'processing', client_time
  );
  return null;
end;
$$;

create or replace function private.finish_operation(
  target_workspace uuid,
  target_operation uuid,
  target_entity_type text,
  target_entity_id uuid,
  target_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sync_operations
  set status = 'applied',
      entity_type = target_entity_type,
      entity_id = target_entity_id,
      result = coalesce(target_result, '{}'::jsonb),
      applied_at = now()
  where workspace_id = target_workspace and operation_id = target_operation;
  if not found then raise exception 'OPERATION_RECEIPT_MISSING'; end if;
end;
$$;

revoke all on function private.begin_operation(uuid, uuid, uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.finish_operation(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;

create or replace function private.write_audit(
  target_workspace uuid,
  actor uuid,
  target_action text,
  target_entity_type text,
  target_entity_id uuid,
  target_request_id uuid,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs(
    workspace_id, actor_id, action, entity_type, entity_id, request_id, metadata
  ) values (
    target_workspace, actor, target_action, target_entity_type,
    target_entity_id, target_request_id, coalesce(target_metadata, '{}'::jsonb)
  )
$$;

revoke all on function private.write_audit(uuid, uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function private.post_cash(
  target_workspace uuid,
  actor uuid,
  target_direction text,
  target_type text,
  target_amount numeric,
  reference_type text,
  reference_id uuid,
  target_operation uuid,
  target_notes text default null,
  target_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.cash_accounts%rowtype;
  next_balance numeric(18,2);
  transaction_id uuid;
begin
  if target_amount is null or target_amount <= 0 then raise exception 'INVALID_CASH_AMOUNT'; end if;
  if target_direction not in ('IN', 'OUT') then raise exception 'INVALID_CASH_DIRECTION'; end if;

  select * into account
  from public.cash_accounts
  where workspace_id = target_workspace and is_primary
  for update;
  if account.id is null then raise exception 'CASH_ACCOUNT_NOT_FOUND'; end if;

  next_balance := account.current_balance + case when target_direction = 'IN' then target_amount else -target_amount end;
  if next_balance < 0 then raise exception 'INSUFFICIENT_CASH_BALANCE'; end if;

  update public.cash_accounts
  set current_balance = next_balance
  where id = account.id;

  insert into public.cash_transactions(
    workspace_id, cash_account_id, direction, transaction_type, amount,
    balance_after, reference_type, reference_id, notes, occurred_at,
    created_by, operation_id
  ) values (
    target_workspace, account.id, target_direction, target_type, target_amount,
    next_balance, reference_type, reference_id, nullif(btrim(target_notes), ''),
    coalesce(target_occurred_at, now()), actor, target_operation
  ) returning id into transaction_id;
  return transaction_id;
end;
$$;

revoke all on function private.post_cash(uuid, uuid, text, text, numeric, text, uuid, uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.complete_retail_onboarding(target_operation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  draft public.onboarding_drafts%rowtype;
  selected_plan public.plans%rowtype;
  existing_workspace uuid;
  workspace_id uuid;
  workspace_slug text;
  result jsonb;
begin
  if actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select active_workspace_id into existing_workspace
  from public.profiles where id = actor and status = 'active';
  if existing_workspace is not null then
    return jsonb_build_object('workspace_id', existing_workspace, 'idempotent', true);
  end if;

  select * into draft from public.onboarding_drafts where user_id = actor for update;
  if draft.user_id is null then raise exception 'ONBOARDING_DRAFT_REQUIRED'; end if;
  if draft.trade_name is null or char_length(btrim(draft.trade_name)) < 2 then raise exception 'TRADE_NAME_REQUIRED'; end if;
  if draft.subtype is null then raise exception 'RETAIL_SUBTYPE_REQUIRED'; end if;
  if draft.selected_plan_id is null then raise exception 'PLAN_REQUIRED'; end if;

  select * into selected_plan
  from public.plans
  where id = draft.selected_plan_id and status = 'active' and is_public
  for share;
  if selected_plan.id is null then raise exception 'PLAN_UNAVAILABLE'; end if;

  workspace_id := draft.reserved_workspace_id;
  workspace_slug := 'retail-' || substr(replace(workspace_id::text, '-', ''), 1, 16);

  insert into public.retail_workspaces(
    id, name, slug, subtype, owner_name, phone, city, country, currency,
    logo_path, price_display, inventory_policy, allow_credit_sales,
    invoice_prefix, created_by
  ) values (
    workspace_id, btrim(draft.trade_name), workspace_slug, draft.subtype,
    nullif(btrim(draft.owner_name), ''), nullif(btrim(draft.phone), ''),
    nullif(btrim(draft.city), ''), draft.country, draft.currency,
    draft.logo_path, draft.price_display, draft.inventory_policy,
    draft.allow_credit_sales, upper(draft.invoice_prefix), actor
  );

  insert into public.workspace_members(workspace_id, user_id, role, status)
  values(workspace_id, actor, 'OWNER', 'active');

  insert into public.cash_accounts(workspace_id, currency, is_primary)
  values(workspace_id, draft.currency, true);

  insert into public.subscriptions(
    workspace_id, plan_id, status, starts_at, trial_ends_at, ends_at
  ) values (
    workspace_id,
    selected_plan.id,
    case when selected_plan.trial_days > 0 then 'trialing' else 'expired' end,
    now(),
    case when selected_plan.trial_days > 0 then now() + make_interval(days => selected_plan.trial_days) end,
    case when selected_plan.billing_months is not null and coalesce(selected_plan.price_amount, 0) = 0
      then now() + make_interval(months => selected_plan.billing_months)
    end
  );

  update public.profiles set active_workspace_id = workspace_id where id = actor;
  update public.onboarding_drafts
  set current_step = 5, completed_at = now()
  where user_id = actor;

  result := jsonb_build_object('workspace_id', workspace_id, 'idempotent', false);
  insert into public.sync_operations(
    workspace_id, user_id, operation_id, operation_type, entity_type,
    entity_id, status, applied_at, result
  ) values (
    workspace_id, actor, target_operation, 'ONBOARDING_COMPLETE', 'workspace',
    workspace_id, 'applied', now(), result
  );
  perform private.write_audit(
    workspace_id, actor, 'workspace.created', 'workspace', workspace_id,
    target_operation, jsonb_build_object('domain_model', 'RETAIL', 'plan_id', selected_plan.id)
  );
  return result;
end;
$$;

revoke all on function public.complete_retail_onboarding(uuid) from public, anon, authenticated;

create or replace function public.retail_create_product(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace);
  existing jsonb;
  product_id uuid;
  opening_quantity numeric(18,3) := coalesce(nullif(payload->>'opening_quantity', '')::numeric, 0);
  opening_cost numeric(18,4) := coalesce(nullif(payload->>'purchase_price', '')::numeric, 0);
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'PRODUCT_CREATE', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if char_length(btrim(coalesce(payload->>'name', ''))) not between 1 and 180 then raise exception 'INVALID_PRODUCT_NAME'; end if;
  if opening_quantity < 0 or opening_cost < 0 then raise exception 'INVALID_OPENING_STOCK'; end if;

  insert into public.products(
    workspace_id, category_id, name, sku, barcode, purchase_price,
    average_cost, sale_price, stock_on_hand, minimum_stock, unit,
    status, notes, image_path, created_by
  ) values (
    target_workspace,
    nullif(payload->>'category_id', '')::uuid,
    btrim(payload->>'name'),
    nullif(btrim(payload->>'sku'), ''),
    nullif(btrim(payload->>'barcode'), ''),
    opening_cost,
    opening_cost,
    coalesce(nullif(payload->>'sale_price', '')::numeric, 0),
    opening_quantity,
    coalesce(nullif(payload->>'minimum_stock', '')::numeric, 0),
    coalesce(nullif(btrim(payload->>'unit'), ''), 'قطعة'),
    coalesce(nullif(payload->>'status', ''), 'active'),
    nullif(btrim(payload->>'notes'), ''),
    nullif(btrim(payload->>'image_path'), ''),
    actor
  ) returning id into product_id;

  if opening_quantity > 0 then
    insert into public.inventory_movements(
      workspace_id, product_id, movement_type, quantity_delta, balance_after,
      unit_cost, reference_type, reference_id, notes, created_by, operation_id
    ) values (
      target_workspace, product_id, 'OPENING', opening_quantity, opening_quantity,
      opening_cost, 'product', product_id, 'الرصيد الافتتاحي', actor, target_operation
    );
  end if;

  result := jsonb_build_object('product_id', product_id, 'stock_on_hand', opening_quantity);
  perform private.finish_operation(target_workspace, target_operation, 'product', product_id, result);
  perform private.write_audit(target_workspace, actor, 'product.created', 'product', product_id, target_operation, jsonb_build_object('opening_quantity', opening_quantity));
  return result;
end;
$$;

revoke all on function public.retail_create_product(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_adjust_inventory(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace);
  existing jsonb;
  product public.products%rowtype;
  adjustment_type text := coalesce(payload->>'movement_type', 'MANUAL_ADJUSTMENT');
  quantity_delta numeric(18,3);
  next_balance numeric(18,3);
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'INVENTORY_ADJUST', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if adjustment_type not in ('MANUAL_ADJUSTMENT', 'COUNT_ADJUSTMENT') then raise exception 'INVALID_ADJUSTMENT_TYPE'; end if;

  select * into product
  from public.products
  where workspace_id = target_workspace
    and id = (payload->>'product_id')::uuid
    and deleted_at is null
  for update;
  if product.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if adjustment_type = 'COUNT_ADJUSTMENT' then
    quantity_delta := (payload->>'counted_quantity')::numeric - product.stock_on_hand;
  else
    quantity_delta := nullif(payload->>'quantity_delta', '')::numeric;
  end if;
  if quantity_delta is null or quantity_delta = 0 then raise exception 'INVALID_QUANTITY'; end if;
  next_balance := product.stock_on_hand + quantity_delta;
  if next_balance < 0 then raise exception 'INSUFFICIENT_STOCK'; end if;
  if char_length(btrim(coalesce(payload->>'notes', ''))) < 3 then raise exception 'ADJUSTMENT_NOTE_REQUIRED'; end if;

  update public.products set stock_on_hand = next_balance where id = product.id;
  insert into public.inventory_movements(
    workspace_id, product_id, movement_type, quantity_delta, balance_after,
    unit_cost, reference_type, reference_id, notes, occurred_at, created_by, operation_id
  ) values (
    target_workspace, product.id, adjustment_type, quantity_delta, next_balance,
    product.average_cost, 'inventory_adjustment', target_operation,
    btrim(payload->>'notes'), coalesce(nullif(payload->>'occurred_at', '')::timestamptz, now()),
    actor, target_operation
  );

  result := jsonb_build_object('product_id', product.id, 'stock_on_hand', next_balance, 'quantity_delta', quantity_delta);
  perform private.finish_operation(target_workspace, target_operation, 'product', product.id, result);
  perform private.write_audit(target_workspace, actor, 'inventory.adjusted', 'product', product.id, target_operation, jsonb_build_object('quantity_delta', quantity_delta, 'balance_after', next_balance));
  return result;
end;
$$;

revoke all on function public.retail_adjust_inventory(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_adjust_cash(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace, array['OWNER', 'MANAGER']::text[]);
  existing jsonb;
  amount_delta numeric(18,2) := nullif(payload->>'amount_delta', '')::numeric;
  transaction_type text := coalesce(payload->>'transaction_type', 'MANUAL_ADJUSTMENT');
  cash_id uuid;
  balance numeric(18,2);
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'CASH_ADJUST', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if amount_delta is null or amount_delta = 0 then raise exception 'INVALID_CASH_AMOUNT'; end if;
  if transaction_type not in ('OPENING', 'MANUAL_ADJUSTMENT') then raise exception 'INVALID_CASH_ADJUSTMENT_TYPE'; end if;
  if char_length(btrim(coalesce(payload->>'notes', ''))) < 3 then raise exception 'ADJUSTMENT_NOTE_REQUIRED'; end if;
  if transaction_type = 'OPENING' and exists (
    select 1 from public.cash_transactions where workspace_id = target_workspace
  ) then raise exception 'OPENING_BALANCE_ALREADY_RECORDED'; end if;

  cash_id := private.post_cash(
    target_workspace, actor,
    case when amount_delta > 0 then 'IN' else 'OUT' end,
    transaction_type, abs(amount_delta), 'cash_adjustment', target_operation,
    target_operation, payload->>'notes', coalesce(nullif(payload->>'occurred_at', '')::timestamptz, now())
  );
  select current_balance into balance from public.cash_accounts
  where workspace_id = target_workspace and is_primary;
  result := jsonb_build_object('cash_transaction_id', cash_id, 'cash_balance', balance);
  perform private.finish_operation(target_workspace, target_operation, 'cash_transaction', cash_id, result);
  perform private.write_audit(target_workspace, actor, 'cash.adjusted', 'cash_transaction', cash_id, target_operation, jsonb_build_object('amount_delta', amount_delta, 'balance_after', balance));
  return result;
end;
$$;

revoke all on function public.retail_adjust_cash(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_create_expense(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace);
  existing jsonb;
  workspace_currency text;
  expense_id uuid;
  amount_value numeric(18,2) := nullif(payload->>'amount', '')::numeric;
  method text := coalesce(payload->>'payment_method', 'CASH');
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'EXPENSE_CREATE', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if amount_value is null or amount_value <= 0 then raise exception 'INVALID_EXPENSE_AMOUNT'; end if;
  if method not in ('CASH', 'BANK', 'WALLET', 'OTHER') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if char_length(btrim(coalesce(payload->>'category', ''))) < 1 then raise exception 'EXPENSE_CATEGORY_REQUIRED'; end if;
  if char_length(btrim(coalesce(payload->>'description', ''))) < 1 then raise exception 'EXPENSE_DESCRIPTION_REQUIRED'; end if;
  select currency into workspace_currency from public.retail_workspaces where id = target_workspace;

  insert into public.expenses(
    workspace_id, category, amount, currency, description, payment_method,
    attachment_path, expense_date, occurred_at, created_by, operation_id
  ) values (
    target_workspace, btrim(payload->>'category'), amount_value, workspace_currency,
    btrim(payload->>'description'), method, nullif(btrim(payload->>'attachment_path'), ''),
    coalesce(nullif(payload->>'expense_date', '')::date, current_date),
    coalesce(nullif(payload->>'occurred_at', '')::timestamptz, now()), actor, target_operation
  ) returning id into expense_id;

  if method = 'CASH' then
    perform private.post_cash(
      target_workspace, actor, 'OUT', 'EXPENSE', amount_value,
      'expense', expense_id, target_operation, payload->>'description',
      coalesce(nullif(payload->>'occurred_at', '')::timestamptz, now())
    );
  end if;

  result := jsonb_build_object('expense_id', expense_id, 'amount', amount_value);
  perform private.finish_operation(target_workspace, target_operation, 'expense', expense_id, result);
  perform private.write_audit(target_workspace, actor, 'expense.created', 'expense', expense_id, target_operation, jsonb_build_object('amount', amount_value, 'payment_method', method));
  return result;
end;
$$;

revoke all on function public.retail_create_expense(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
