-- Retail remains an isolated database. This service-role-only entry point lets
-- MADAR Platform provision or renew a Retail workspace after central approval.

alter table public.retail_workspaces
  add column if not exists platform_activation_request_id uuid;

create unique index if not exists retail_workspaces_platform_activation_request_uidx
  on public.retail_workspaces(platform_activation_request_id)
  where platform_activation_request_id is not null;

create or replace function public.activate_retail_service(
  actor_user uuid,
  platform_organization uuid,
  platform_request uuid,
  service_setup jsonb,
  subscription_ends_at timestamptz,
  subscription_grace_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.role()::text,
    ''
  );
  setup jsonb := coalesce(service_setup, '{}'::jsonb);
  selected_plan public.plans%rowtype;
  linked_workspace uuid;
  result jsonb;
  retail_subtype text := upper(coalesce(setup->>'subtype', 'GENERAL_RETAIL'));
  currency_value text := upper(coalesce(setup->>'currency', 'YER'));
  invoice_value text := upper(coalesce(setup->>'invoice_prefix', 'MR'));
  credit_value boolean := lower(coalesce(setup->>'allow_credit_sales', 'true')) in ('true','1','yes','on');
begin
  if caller_role <> 'service_role' then
    raise exception 'PLATFORM_BRIDGE_SERVICE_ROLE_REQUIRED';
  end if;
  if actor_user is null or platform_organization is null or platform_request is null then
    raise exception 'PLATFORM_ACTIVATION_CONTEXT_REQUIRED';
  end if;
  if subscription_ends_at is null or subscription_ends_at <= now() then
    raise exception 'ACTIVE_SUBSCRIPTION_END_REQUIRED';
  end if;
  if jsonb_typeof(setup) <> 'object' or octet_length(setup::text) > 20000 then
    raise exception 'INVALID_SERVICE_SETUP';
  end if;
  if char_length(btrim(coalesce(setup->>'trade_name', ''))) not between 2 and 120 then
    raise exception 'TRADE_NAME_REQUIRED';
  end if;
  if retail_subtype not in (
    'CLOTHING','PERFUME','GROCERY','ELECTRONICS','ACCESSORIES',
    'SPARE_PARTS','GENERAL_RETAIL','OTHER'
  ) then raise exception 'INVALID_RETAIL_SUBTYPE'; end if;
  if currency_value not in ('YER','SAR','USD') then raise exception 'INVALID_CURRENCY'; end if;
  if invoice_value !~ '^[A-Z0-9-]{1,8}$' then raise exception 'INVALID_INVOICE_PREFIX'; end if;

  if not exists (
    select 1 from public.profiles
    where id = actor_user and status = 'active' and identity_source = 'MADAR_PLATFORM'
  ) then raise exception 'PLATFORM_IDENTITY_REQUIRED'; end if;

  select * into selected_plan
  from public.plans
  where status = 'active' and is_public
  order by created_at
  limit 1
  for share;
  if selected_plan.id is null then raise exception 'RETAIL_INTERNAL_PLAN_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(platform_organization::text, 0));
  perform set_config('request.jwt.claim.sub', actor_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_user, 'role', 'authenticated')::text,
    true
  );

  select id into linked_workspace
  from public.retail_workspaces
  where platform_organization_id = platform_organization;

  if linked_workspace is null then
    insert into public.onboarding_drafts(
      user_id, current_step, trade_name, owner_name, phone, city, country,
      currency, subtype, price_display, inventory_policy, allow_credit_sales,
      invoice_prefix, selected_plan_id, platform_organization_id
    ) values (
      actor_user, 5, btrim(setup->>'trade_name'),
      nullif(btrim(setup->>'owner_name'), ''),
      nullif(btrim(setup->>'phone'), ''),
      nullif(btrim(setup->>'city'), ''),
      upper(coalesce(nullif(setup->>'country', ''), 'YE')),
      currency_value, retail_subtype,
      case when setup->>'price_display' = 'tax_inclusive' then 'tax_inclusive' else 'simple' end,
      'prevent_negative', credit_value, invoice_value, selected_plan.id,
      platform_organization
    )
    on conflict (user_id) do update set
      current_step = 5,
      trade_name = excluded.trade_name,
      owner_name = excluded.owner_name,
      phone = excluded.phone,
      city = excluded.city,
      country = excluded.country,
      currency = excluded.currency,
      subtype = excluded.subtype,
      price_display = excluded.price_display,
      inventory_policy = excluded.inventory_policy,
      allow_credit_sales = excluded.allow_credit_sales,
      invoice_prefix = excluded.invoice_prefix,
      selected_plan_id = excluded.selected_plan_id,
      platform_organization_id = excluded.platform_organization_id,
      completed_at = null,
      updated_at = now();

    result := public.complete_retail_onboarding(platform_request);
    linked_workspace := nullif(result->>'workspace_id', '')::uuid;
    update public.retail_workspaces
    set platform_organization_id = platform_organization,
        platform_activation_request_id = platform_request,
        status = 'active',
        updated_at = now()
    where id = linked_workspace;
  else
    result := jsonb_build_object('workspace_id', linked_workspace, 'idempotent', true);
    update public.retail_workspaces
    set platform_activation_request_id = coalesce(platform_activation_request_id, platform_request),
        status = 'active', updated_at = now()
    where id = linked_workspace;
  end if;

  insert into public.workspace_members(workspace_id, user_id, role, status)
  values(linked_workspace, actor_user, 'OWNER', 'active')
  on conflict (workspace_id, user_id) do update
  set role = 'OWNER', status = 'active', updated_at = now();

  update public.profiles set active_workspace_id = linked_workspace, updated_at = now()
  where id = actor_user;

  update public.subscriptions
  set plan_id = selected_plan.id,
      status = 'active',
      starts_at = case when ends_at is null or ends_at <= now() then now() else starts_at end,
      trial_ends_at = null,
      ends_at = subscription_ends_at,
      grace_ends_at = subscription_grace_ends_at,
      approved_at = now(),
      updated_at = now()
  where workspace_id = linked_workspace;

  perform private.write_audit(
    linked_workspace,
    actor_user,
    'service.activated',
    'workspace',
    linked_workspace,
    platform_request,
    jsonb_build_object(
      'source', 'MADAR_PLATFORM',
      'platform_organization_id', platform_organization,
      'subscription_ends_at', subscription_ends_at
    )
  );

  return result || jsonb_build_object(
    'workspace_id', linked_workspace,
    'subscription_ends_at', subscription_ends_at
  );
end;
$$;

revoke all on function public.activate_retail_service(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.activate_retail_service(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz
) to service_role;

comment on function public.activate_retail_service(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz
) is 'Idempotent service-role bridge called only after MADAR Platform approves a Retail service payment.';
