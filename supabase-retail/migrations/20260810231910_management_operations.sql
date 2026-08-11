-- MADAR Retail V0 — audited, non-ledger management mutations.

create or replace function public.update_my_retail_profile(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if payload ? 'full_name' and char_length(btrim(coalesce(payload->>'full_name', ''))) not between 2 and 100 then
    raise exception 'INVALID_FULL_NAME';
  end if;
  update public.profiles
  set full_name = case when payload ? 'full_name' then nullif(btrim(payload->>'full_name'), '') else full_name end,
      phone = case when payload ? 'phone' then nullif(btrim(payload->>'phone'), '') else phone end,
      avatar_url = case when payload ? 'avatar_url' then nullif(btrim(payload->>'avatar_url'), '') else avatar_url end
  where id = actor and status = 'active';
  if not found then raise exception 'ACCOUNT_DISABLED'; end if;
  return jsonb_build_object('profile_id', actor);
end;
$$;

revoke all on function public.update_my_retail_profile(jsonb) from public, anon, authenticated;

create or replace function public.set_active_retail_workspace(target_workspace uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_workspace_member(target_workspace) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  update public.profiles set active_workspace_id = target_workspace where id = actor;
  return jsonb_build_object('workspace_id', target_workspace);
end;
$$;

revoke all on function public.set_active_retail_workspace(uuid) from public, anon, authenticated;

create or replace function public.retail_update_workspace_settings(
  target_workspace uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := private.require_workspace_actor(target_workspace, array['OWNER', 'MANAGER']::text[]);
begin
  if payload ? 'name' and char_length(btrim(coalesce(payload->>'name', ''))) not between 2 and 120 then raise exception 'INVALID_TRADE_NAME'; end if;
  if payload ? 'invoice_prefix' and upper(payload->>'invoice_prefix') !~ '^[A-Z0-9-]{1,8}$' then raise exception 'INVALID_INVOICE_PREFIX'; end if;
  update public.retail_workspaces
  set name = case when payload ? 'name' then btrim(payload->>'name') else name end,
      owner_name = case when payload ? 'owner_name' then nullif(btrim(payload->>'owner_name'), '') else owner_name end,
      phone = case when payload ? 'phone' then nullif(btrim(payload->>'phone'), '') else phone end,
      city = case when payload ? 'city' then nullif(btrim(payload->>'city'), '') else city end,
      logo_path = case when payload ? 'logo_path' then nullif(btrim(payload->>'logo_path'), '') else logo_path end,
      price_display = case when payload ? 'price_display' then payload->>'price_display' else price_display end,
      allow_credit_sales = case when payload ? 'allow_credit_sales' then (payload->>'allow_credit_sales')::boolean else allow_credit_sales end,
      invoice_prefix = case when payload ? 'invoice_prefix' then upper(payload->>'invoice_prefix') else invoice_prefix end
  where id = target_workspace;
  perform private.write_audit(target_workspace, actor, 'workspace.settings_updated', 'workspace', target_workspace, gen_random_uuid(), '{}'::jsonb);
  return jsonb_build_object('workspace_id', target_workspace);
end;
$$;

revoke all on function public.retail_update_workspace_settings(uuid, jsonb) from public, anon, authenticated;

create or replace function public.retail_upsert_category(
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
  target_id uuid := nullif(payload->>'id', '')::uuid;
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'CATEGORY_UPSERT', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if char_length(btrim(coalesce(payload->>'name', ''))) not between 1 and 100 then raise exception 'INVALID_CATEGORY_NAME'; end if;
  if target_id is null then
    insert into public.categories(workspace_id, name, created_by)
    values(target_workspace, btrim(payload->>'name'), actor) returning id into target_id;
  else
    update public.categories set name = btrim(payload->>'name'), deleted_at = null
    where workspace_id = target_workspace and id = target_id;
    if not found then raise exception 'CATEGORY_NOT_FOUND'; end if;
  end if;
  result := jsonb_build_object('category_id', target_id);
  perform private.finish_operation(target_workspace, target_operation, 'category', target_id, result);
  perform private.write_audit(target_workspace, actor, 'category.upserted', 'category', target_id, target_operation, '{}'::jsonb);
  return result;
end;
$$;

revoke all on function public.retail_upsert_category(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_update_product(
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
  target_id uuid := (payload->>'id')::uuid;
  delete_requested boolean := coalesce((payload->>'delete')::boolean, false);
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'PRODUCT_UPDATE', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  select * into product from public.products where workspace_id = target_workspace and id = target_id for update;
  if product.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if delete_requested and product.stock_on_hand <> 0 then raise exception 'PRODUCT_WITH_STOCK_CANNOT_BE_DELETED'; end if;
  if payload ? 'name' and char_length(btrim(coalesce(payload->>'name', ''))) not between 1 and 180 then raise exception 'INVALID_PRODUCT_NAME'; end if;

  update public.products
  set category_id = case when payload ? 'category_id' then nullif(payload->>'category_id', '')::uuid else category_id end,
      name = case when payload ? 'name' then btrim(payload->>'name') else name end,
      sku = case when payload ? 'sku' then nullif(btrim(payload->>'sku'), '') else sku end,
      barcode = case when payload ? 'barcode' then nullif(btrim(payload->>'barcode'), '') else barcode end,
      purchase_price = case when payload ? 'purchase_price' then (payload->>'purchase_price')::numeric else purchase_price end,
      sale_price = case when payload ? 'sale_price' then (payload->>'sale_price')::numeric else sale_price end,
      minimum_stock = case when payload ? 'minimum_stock' then (payload->>'minimum_stock')::numeric else minimum_stock end,
      unit = case when payload ? 'unit' then btrim(payload->>'unit') else unit end,
      status = case when payload ? 'status' then payload->>'status' else status end,
      notes = case when payload ? 'notes' then nullif(btrim(payload->>'notes'), '') else notes end,
      image_path = case when payload ? 'image_path' then nullif(btrim(payload->>'image_path'), '') else image_path end,
      deleted_at = case when delete_requested then now() else deleted_at end
  where id = target_id and workspace_id = target_workspace;

  result := jsonb_build_object('product_id', target_id, 'deleted', delete_requested);
  perform private.finish_operation(target_workspace, target_operation, 'product', target_id, result);
  perform private.write_audit(target_workspace, actor, case when delete_requested then 'product.deleted' else 'product.updated' end, 'product', target_id, target_operation, '{}'::jsonb);
  return result;
end;
$$;

revoke all on function public.retail_update_product(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_upsert_customer(
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
  target_id uuid := nullif(payload->>'id', '')::uuid;
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'CUSTOMER_UPSERT', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if char_length(btrim(coalesce(payload->>'name', ''))) not between 1 and 160 then raise exception 'INVALID_CUSTOMER_NAME'; end if;
  if target_id is null then
    insert into public.customers(workspace_id, name, phone, notes, created_by)
    values(target_workspace, btrim(payload->>'name'), nullif(btrim(payload->>'phone'), ''), nullif(btrim(payload->>'notes'), ''), actor)
    returning id into target_id;
  else
    update public.customers
    set name = btrim(payload->>'name'),
        phone = case when payload ? 'phone' then nullif(btrim(payload->>'phone'), '') else phone end,
        notes = case when payload ? 'notes' then nullif(btrim(payload->>'notes'), '') else notes end,
        status = case when payload ? 'status' then payload->>'status' else status end,
        deleted_at = null
    where workspace_id = target_workspace and id = target_id;
    if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  end if;
  result := jsonb_build_object('customer_id', target_id);
  perform private.finish_operation(target_workspace, target_operation, 'customer', target_id, result);
  perform private.write_audit(target_workspace, actor, 'customer.upserted', 'customer', target_id, target_operation, '{}'::jsonb);
  return result;
end;
$$;

revoke all on function public.retail_upsert_customer(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_upsert_supplier(
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
  target_id uuid := nullif(payload->>'id', '')::uuid;
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'SUPPLIER_UPSERT', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if char_length(btrim(coalesce(payload->>'name', ''))) not between 1 and 160 then raise exception 'INVALID_SUPPLIER_NAME'; end if;
  if target_id is null then
    insert into public.suppliers(workspace_id, name, phone, notes, created_by)
    values(target_workspace, btrim(payload->>'name'), nullif(btrim(payload->>'phone'), ''), nullif(btrim(payload->>'notes'), ''), actor)
    returning id into target_id;
  else
    update public.suppliers
    set name = btrim(payload->>'name'),
        phone = case when payload ? 'phone' then nullif(btrim(payload->>'phone'), '') else phone end,
        notes = case when payload ? 'notes' then nullif(btrim(payload->>'notes'), '') else notes end,
        status = case when payload ? 'status' then payload->>'status' else status end,
        deleted_at = null
    where workspace_id = target_workspace and id = target_id;
    if not found then raise exception 'SUPPLIER_NOT_FOUND'; end if;
  end if;
  result := jsonb_build_object('supplier_id', target_id);
  perform private.finish_operation(target_workspace, target_operation, 'supplier', target_id, result);
  perform private.write_audit(target_workspace, actor, 'supplier.upserted', 'supplier', target_id, target_operation, '{}'::jsonb);
  return result;
end;
$$;

revoke all on function public.retail_upsert_supplier(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.admin_upsert_retail_plan(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); target_id uuid := nullif(payload->>'id', '')::uuid;
begin
  if actor is null or not private.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(btrim(coalesce(payload->>'name_ar', ''))) not between 2 and 100 then raise exception 'INVALID_PLAN_NAME'; end if;
  if target_id is null then
    insert into public.plans(code, name_ar, description_ar, status, is_public, price_amount, currency, billing_months, trial_days, grace_days, features, limits)
    values(upper(payload->>'code'), btrim(payload->>'name_ar'), nullif(btrim(payload->>'description_ar'), ''), coalesce(payload->>'status', 'draft'), coalesce((payload->>'is_public')::boolean, false), nullif(payload->>'price_amount', '')::numeric, coalesce(payload->>'currency', 'YER'), nullif(payload->>'billing_months', '')::integer, coalesce(nullif(payload->>'trial_days', '')::integer, 0), coalesce(nullif(payload->>'grace_days', '')::integer, 0), coalesce(payload->'features', '{}'::jsonb), coalesce(payload->'limits', '{}'::jsonb))
    returning id into target_id;
  else
    update public.plans set
      name_ar = btrim(payload->>'name_ar'), description_ar = nullif(btrim(payload->>'description_ar'), ''),
      status = coalesce(payload->>'status', status), is_public = coalesce((payload->>'is_public')::boolean, is_public),
      price_amount = case when payload ? 'price_amount' then nullif(payload->>'price_amount', '')::numeric else price_amount end,
      currency = coalesce(payload->>'currency', currency), billing_months = case when payload ? 'billing_months' then nullif(payload->>'billing_months', '')::integer else billing_months end,
      trial_days = coalesce(nullif(payload->>'trial_days', '')::integer, trial_days), grace_days = coalesce(nullif(payload->>'grace_days', '')::integer, grace_days),
      features = coalesce(payload->'features', features), limits = coalesce(payload->'limits', limits)
    where id = target_id;
    if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  end if;
  perform private.write_audit(null, actor, 'plan.upserted', 'plan', target_id, gen_random_uuid(), '{}'::jsonb);
  return jsonb_build_object('plan_id', target_id);
end;
$$;

revoke all on function public.admin_upsert_retail_plan(jsonb) from public, anon, authenticated;

create or replace function public.record_orby_retail_exchange(
  target_workspace uuid,
  target_conversation uuid,
  user_message text,
  assistant_message text,
  evidence_value jsonb default '[]'::jsonb,
  provider_value text default null,
  model_value text default null,
  response_status text default 'complete',
  prompt_token_count integer default null,
  completion_token_count integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace, array['OWNER', 'MANAGER', 'STAFF', 'VIEWER']::text[]);
  conversation_id_value uuid := target_conversation;
  user_message_id uuid;
  assistant_message_id uuid;
begin
  if char_length(btrim(coalesce(user_message, ''))) not between 1 and 12000 then raise exception 'INVALID_ORBY_MESSAGE'; end if;
  if char_length(btrim(coalesce(assistant_message, ''))) not between 1 and 12000 then raise exception 'INVALID_ORBY_RESPONSE'; end if;
  if jsonb_typeof(evidence_value) <> 'array' then raise exception 'INVALID_ORBY_EVIDENCE'; end if;
  if response_status not in ('complete', 'error') then raise exception 'INVALID_ORBY_STATUS'; end if;

  if conversation_id_value is null then
    insert into public.orby_conversations(workspace_id, title, created_by)
    values(target_workspace, left(btrim(user_message), 120), actor)
    returning id into conversation_id_value;
  elsif not exists (
    select 1 from public.orby_conversations
    where id = conversation_id_value and workspace_id = target_workspace and created_by = actor
  ) then raise exception 'ORBY_CONVERSATION_NOT_FOUND'; end if;

  insert into public.orby_messages(
    workspace_id, conversation_id, role, content, created_by
  ) values (
    target_workspace, conversation_id_value, 'user', btrim(user_message), actor
  ) returning id into user_message_id;

  insert into public.orby_messages(
    workspace_id, conversation_id, role, content, status, evidence,
    provider, model, prompt_tokens, completion_tokens, created_by
  ) values (
    target_workspace, conversation_id_value, 'assistant', btrim(assistant_message),
    response_status, evidence_value, nullif(provider_value, ''), nullif(model_value, ''),
    prompt_token_count, completion_token_count, actor
  ) returning id into assistant_message_id;

  update public.orby_conversations set updated_at = now() where id = conversation_id_value;
  perform private.write_audit(
    target_workspace, actor, 'orby.read_answer', 'orby_conversation',
    conversation_id_value, gen_random_uuid(),
    jsonb_build_object('evidence_count', jsonb_array_length(evidence_value), 'status', response_status)
  );
  return jsonb_build_object(
    'conversation_id', conversation_id_value,
    'user_message_id', user_message_id,
    'assistant_message_id', assistant_message_id
  );
end;
$$;

revoke all on function public.record_orby_retail_exchange(uuid, uuid, text, text, jsonb, text, text, text, integer, integer) from public, anon, authenticated;

create or replace function public.reserve_orby_retail_request(target_workspace uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace, array['OWNER', 'MANAGER', 'STAFF', 'VIEWER']::text[]);
  local_day date;
  daily_limit integer;
  next_count integer;
begin
  select (now() at time zone w.timezone)::date,
         coalesce((p.limits->>'orby_daily_requests')::integer, 30)
  into local_day, daily_limit
  from public.retail_workspaces w
  join public.subscriptions s on s.workspace_id = w.id
  join public.plans p on p.id = s.plan_id
  where w.id = target_workspace;
  daily_limit := least(greatest(daily_limit, 0), 10000);

  insert into public.orby_usage_daily(workspace_id, usage_date, request_count)
  values(target_workspace, local_day, 1)
  on conflict (workspace_id, usage_date) do update
  set request_count = public.orby_usage_daily.request_count + 1,
      updated_at = now()
  where public.orby_usage_daily.request_count < daily_limit
  returning request_count into next_count;

  if next_count is null or next_count > daily_limit then raise exception 'ORBY_DAILY_LIMIT_REACHED'; end if;
  return jsonb_build_object('usage_date', local_day, 'used', next_count, 'limit', daily_limit, 'actor_id', actor);
end;
$$;

revoke all on function public.reserve_orby_retail_request(uuid) from public, anon, authenticated;

create or replace function public.admin_upsert_retail_payment_method(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); target_id uuid := nullif(payload->>'id', '')::uuid;
begin
  if actor is null or not private.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(btrim(coalesce(payload->>'name_ar', ''))) not between 2 and 100 then raise exception 'INVALID_PAYMENT_METHOD_NAME'; end if;
  if target_id is null then
    insert into public.payment_methods(code, name_ar, kind, account_name, account_identifier, instructions_ar, currency, status, sort_order)
    values(upper(payload->>'code'), btrim(payload->>'name_ar'), payload->>'kind', nullif(btrim(payload->>'account_name'), ''), nullif(btrim(payload->>'account_identifier'), ''), nullif(btrim(payload->>'instructions_ar'), ''), coalesce(payload->>'currency', 'YER'), coalesce(payload->>'status', 'draft'), coalesce(nullif(payload->>'sort_order', '')::integer, 100))
    returning id into target_id;
  else
    update public.payment_methods set
      name_ar = btrim(payload->>'name_ar'), kind = coalesce(payload->>'kind', kind),
      account_name = case when payload ? 'account_name' then nullif(btrim(payload->>'account_name'), '') else account_name end,
      account_identifier = case when payload ? 'account_identifier' then nullif(btrim(payload->>'account_identifier'), '') else account_identifier end,
      instructions_ar = case when payload ? 'instructions_ar' then nullif(btrim(payload->>'instructions_ar'), '') else instructions_ar end,
      currency = coalesce(payload->>'currency', currency), status = coalesce(payload->>'status', status),
      sort_order = coalesce(nullif(payload->>'sort_order', '')::integer, sort_order)
    where id = target_id;
    if not found then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  end if;
  perform private.write_audit(null, actor, 'payment_method.upserted', 'payment_method', target_id, gen_random_uuid(), '{}'::jsonb);
  return jsonb_build_object('payment_method_id', target_id);
end;
$$;

revoke all on function public.admin_upsert_retail_payment_method(jsonb) from public, anon, authenticated;
