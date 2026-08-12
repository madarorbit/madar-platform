-- MADAR Retail integration bridge inside the primary MADAR database.
-- MADAR Platform owns authentication and authorization. Retail keeps an
-- explicit table namespace and workspace boundary, not a second Auth system.

alter table public.retail_profiles
  add column if not exists identity_source text not null default 'RETAIL_AUTH';

alter table public.retail_profiles drop constraint if exists profiles_identity_source_check;
alter table public.retail_profiles
  add constraint profiles_identity_source_check
  check (identity_source in ('RETAIL_AUTH', 'MADAR_PLATFORM'));

alter table public.retail_workspaces
  add column if not exists platform_organization_id uuid;

create unique index if not exists retail_workspaces_platform_organization_uidx
  on public.retail_workspaces(platform_organization_id)
  where platform_organization_id is not null;

alter table public.retail_onboarding_drafts
  add column if not exists platform_organization_id uuid;

create index if not exists retail_onboarding_drafts_platform_organization_idx
  on public.retail_onboarding_drafts(platform_organization_id, completed_at);

create or replace function public.retail_platform_execute(
  actor_user uuid,
  operation_name text,
  operation_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role()::text, '');
  result jsonb;
  target_workspace uuid;
  linked_workspace uuid;
  platform_organization uuid;
  requested_role text;
begin
  if caller_role <> 'service_role' then
    raise exception 'PLATFORM_BRIDGE_SERVICE_ROLE_REQUIRED';
  end if;
  if actor_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if operation_name is null or operation_name = '' then raise exception 'INVALID_OPERATION'; end if;
  operation_args := coalesce(operation_args, '{}'::jsonb);

  if not exists (
    select 1 from public.retail_profiles
    where id = actor_user and status = 'active' and identity_source = 'MADAR_PLATFORM'
  ) then
    raise exception 'PLATFORM_IDENTITY_REQUIRED';
  end if;

  -- Existing Retail functions continue to enforce their original role,
  -- subscription, idempotency, and ledger rules through auth.uid().
  perform set_config('request.jwt.claim.sub', actor_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_user, 'role', 'authenticated')::text,
    true
  );

  if operation_name = 'complete_retail_onboarding' then
    platform_organization := nullif(operation_args->>'platform_organization_id', '')::uuid;
    requested_role := coalesce(nullif(operation_args->>'retail_role', ''), 'STAFF');
    if platform_organization is null then raise exception 'PLATFORM_ORGANIZATION_REQUIRED'; end if;
    if requested_role not in ('OWNER', 'MANAGER', 'STAFF', 'VIEWER') then
      raise exception 'INVALID_RETAIL_ROLE';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(platform_organization::text, 0));
    select id into linked_workspace
    from public.retail_workspaces
    where platform_organization_id = platform_organization;

    if linked_workspace is not null then
      insert into public.retail_workspace_members(workspace_id, user_id, role, status)
      values(linked_workspace, actor_user, requested_role, 'active')
      on conflict (workspace_id, user_id) do update
      set role = excluded.role, status = 'active', updated_at = now();
      update public.retail_profiles set active_workspace_id = linked_workspace where id = actor_user;
      return jsonb_build_object('workspace_id', linked_workspace, 'idempotent', true);
    end if;

    if requested_role not in ('OWNER', 'MANAGER') then raise exception 'ONBOARDING_MANAGER_REQUIRED'; end if;
    if not exists (
      select 1 from public.retail_onboarding_drafts
      where user_id = actor_user and platform_organization_id = platform_organization
    ) then
      raise exception 'ONBOARDING_DRAFT_REQUIRED';
    end if;

    result := public.complete_retail_onboarding(
      nullif(operation_args->>'target_operation', '')::uuid
    );
    target_workspace := nullif(result->>'workspace_id', '')::uuid;
    update public.retail_workspaces
    set platform_organization_id = platform_organization
    where id = target_workspace;
    update public.retail_workspace_members
    set role = requested_role, status = 'active', updated_at = now()
    where workspace_id = target_workspace and user_id = actor_user;
    return result;

  elsif operation_name = 'retail_create_product' then
    result := public.retail_create_product(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_update_product' then
    result := public.retail_update_product(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_upsert_category' then
    result := public.retail_upsert_category(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_upsert_customer' then
    result := public.retail_upsert_customer(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_upsert_supplier' then
    result := public.retail_upsert_supplier(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_adjust_inventory' then
    result := public.retail_adjust_inventory(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_adjust_cash' then
    result := public.retail_adjust_cash(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_create_sale' then
    result := public.retail_create_sale(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_create_purchase' then
    result := public.retail_create_purchase(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_create_expense' then
    result := public.retail_create_expense(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_collect_receivable' then
    result := public.retail_collect_receivable(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_pay_payable' then
    result := public.retail_pay_payable(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_record_sale_return' then
    result := public.retail_record_sale_return(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload',
      nullif(operation_args->>'source_device', '')::uuid
    );
  elsif operation_name = 'retail_update_workspace_settings' then
    result := public.retail_update_workspace_settings(
      (operation_args->>'target_workspace')::uuid,
      operation_args->'payload'
    );
  elsif operation_name = 'retail_submit_payment_request' then
    result := public.retail_submit_payment_request(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_operation')::uuid,
      operation_args->'payload'
    );
  elsif operation_name = 'retail_analytics_snapshot' then
    result := public.retail_analytics_snapshot(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'date_from')::date,
      (operation_args->>'date_to')::date
    );
  elsif operation_name = 'retail_customer_summaries' then
    select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) into result
    from public.retail_customer_summaries((operation_args->>'target_workspace')::uuid) item;
  elsif operation_name = 'retail_supplier_summaries' then
    select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) into result
    from public.retail_supplier_summaries((operation_args->>'target_workspace')::uuid) item;
  elsif operation_name = 'reserve_orby_retail_request' then
    result := public.reserve_orby_retail_request((operation_args->>'target_workspace')::uuid);
  elsif operation_name = 'record_orby_retail_exchange' then
    result := public.record_orby_retail_exchange(
      (operation_args->>'target_workspace')::uuid,
      nullif(operation_args->>'target_conversation', '')::uuid,
      operation_args->>'user_message',
      operation_args->>'assistant_message',
      coalesce(operation_args->'evidence_value', '[]'::jsonb),
      nullif(operation_args->>'provider_value', ''),
      nullif(operation_args->>'model_value', ''),
      coalesce(nullif(operation_args->>'response_status', ''), 'complete'),
      nullif(operation_args->>'prompt_token_count', '')::integer,
      nullif(operation_args->>'completion_token_count', '')::integer
    );
  elsif operation_name = 'register_retail_sync_device' then
    result := public.register_retail_sync_device(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_device')::uuid,
      operation_args->>'device_name',
      operation_args->>'platform_name',
      nullif(operation_args->>'app_version_value', '')
    );
  elsif operation_name = 'pull_retail_sync_changes' then
    result := public.pull_retail_sync_changes(
      (operation_args->>'target_workspace')::uuid,
      (operation_args->>'target_device')::uuid,
      coalesce(nullif(operation_args->>'after_cursor', '')::bigint, 0),
      coalesce(nullif(operation_args->>'page_size', '')::integer, 250)
    );
  elsif operation_name = 'admin_review_retail_payment' then
    result := public.admin_review_retail_payment(
      (operation_args->>'target_request')::uuid,
      operation_args->>'decision',
      nullif(operation_args->>'note', '')
    );
  elsif operation_name = 'admin_set_retail_workspace_status' then
    result := public.admin_set_retail_workspace_status(
      (operation_args->>'target_workspace')::uuid,
      operation_args->>'target_status',
      nullif(operation_args->>'note', '')
    );
  elsif operation_name = 'admin_upsert_retail_plan' then
    result := public.admin_upsert_retail_plan(operation_args->'payload');
  elsif operation_name = 'admin_upsert_retail_payment_method' then
    result := public.admin_upsert_retail_payment_method(operation_args->'payload');
  else
    raise exception 'PLATFORM_OPERATION_NOT_ALLOWED';
  end if;

  return coalesce(result, 'null'::jsonb);
end;
$$;

revoke all on function public.retail_platform_execute(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.retail_platform_execute(uuid, text, jsonb)
  to service_role;
