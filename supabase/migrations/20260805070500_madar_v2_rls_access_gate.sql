-- MADAR V2.0 — deny direct REST reads and writes after subscription expiry.
-- Billing, pricing snapshots, account data and payment recovery remain outside
-- this gate so customers can renew without exposing operational workspace data.

create or replace function private.has_v2_workspace_access(
  target_organization uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  organization_type public.organization_type;
  snapshot public.pricing_subscription_snapshots%rowtype;
begin
  if current_user_id is null then
    return false;
  end if;
  if private.is_admin() then
    return true;
  end if;
  if not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization
      and membership.user_id = current_user_id
  ) then
    return false;
  end if;

  select organization.type
  into organization_type
  from public.organizations organization
  where organization.id = target_organization;

  if organization_type is null then
    return false;
  end if;
  if organization_type = 'STUDENT' then
    return exists (
      select 1
      from public.profiles profile
      where profile.id = current_user_id
        and profile.status = 'active'
        and profile.account_type = 'PERSONAL'
    );
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = current_user_id
      and profile.status = 'active'
      and profile.account_type = 'BUSINESS'
  ) then
    return false;
  end if;

  select subscription.*
  into snapshot
  from public.pricing_subscription_snapshots subscription
  where subscription.organization_id = target_organization
  order by
    case when subscription.status in ('trialing', 'active', 'past_due') then 0 else 1 end,
    subscription.created_at desc
  limit 1;

  if snapshot.id is null
     or coalesce((snapshot.locked_entitlements ->> 'workspace_access')::boolean, false) is not true then
    return false;
  end if;

  return
    (snapshot.status = 'trialing'
      and snapshot.trial_ends_at is not null
      and snapshot.trial_ends_at > now())
    or
    (snapshot.status in ('active', 'past_due')
      and snapshot.ends_at is not null
      and snapshot.ends_at > now());
end;
$$;

revoke all on function private.has_v2_workspace_access(uuid)
from public, anon, authenticated;
grant execute on function private.has_v2_workspace_access(uuid)
to authenticated, service_role;

create or replace function private.current_v2_entitlement(
  target_organization uuid,
  entitlement text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role'
     and not private.is_admin()
     and not private.is_organization_member(target_organization) then
    raise exception 'ORGANIZATION_ACCESS_DENIED';
  end if;

  return private.v2_active_subscription_entitlement(
    target_organization,
    entitlement
  );
end;
$$;

revoke all on function private.current_v2_entitlement(uuid, text)
from public, anon, authenticated;
grant execute on function private.current_v2_entitlement(uuid, text)
to authenticated, service_role;

do $$
declare
  protected_table text;
  policy_name text := 'madar v2 workspace access gate';
begin
  foreach protected_table in array array[
    'business_products',
    'business_customers',
    'business_suppliers',
    'business_sales',
    'business_sale_items',
    'business_expenses',
    'business_tasks',
    'inventory_movements',
    'business_imports',
    'activity_profiles',
    'organization_sector_packages',
    'organization_modules',
    'sector_dashboard_configs',
    'sector_report_configs',
    'commerce_purchase_orders',
    'commerce_purchase_order_items',
    'commerce_goods_receipts',
    'commerce_goods_receipt_items',
    'commerce_sales_returns',
    'commerce_sales_return_items',
    'sector_operation_events',
    'integration_connector_requests',
    'integration_schema_snapshots',
    'integration_mapping_previews',
    'integration_sync_previews',
    'integration_inbound_endpoints',
    'integration_inbound_deliveries',
    'integration_health_incidents',
    'integration_permission_grants',
    'integration_consent_log',
    'integration_write_commands',
    'restaurant_locations',
    'restaurant_recipes',
    'restaurant_recipe_ingredients',
    'restaurant_orders',
    'restaurant_order_items',
    'restaurant_kitchen_tickets',
    'hotel_properties',
    'hotel_rooms',
    'hotel_rates',
    'hotel_rate_availability',
    'hotel_reservations',
    'hotel_stays',
    'hotel_housekeeping_tasks',
    'hotel_maintenance_requests',
    'hotel_folios',
    'hotel_folio_charges'
  ] loop
    if to_regclass(format('public.%I', protected_table)) is null then
      raise exception 'EXPECTED_V2_TABLE_MISSING:%', protected_table;
    end if;
    if not exists (
      select 1
      from information_schema.columns column_definition
      where column_definition.table_schema = 'public'
        and column_definition.table_name = protected_table
        and column_definition.column_name = 'organization_id'
    ) then
      raise exception 'EXPECTED_ORGANIZATION_COLUMN_MISSING:%', protected_table;
    end if;

    execute format(
      'drop policy if exists %I on public.%I',
      policy_name,
      protected_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select private.has_v2_workspace_access(organization_id))) with check ((select private.has_v2_workspace_access(organization_id)))',
      policy_name,
      protected_table
    );
  end loop;
end;
$$;

drop policy if exists "madar v2 workspace access gate" on public.activity_profile_answers;
create policy "madar v2 workspace access gate"
on public.activity_profile_answers
as restrictive
for select
to authenticated
using (
  exists (
    select 1
    from public.activity_profiles profile
    where profile.id = activity_profile_id
      and private.has_v2_workspace_access(profile.organization_id)
  )
);

drop policy if exists "madar v2 workspace access gate" on public.integration_write_attempts;
create policy "madar v2 workspace access gate"
on public.integration_write_attempts
as restrictive
for select
to authenticated
using (
  exists (
    select 1
    from public.integration_write_commands command
    where command.id = command_id
      and private.has_v2_workspace_access(command.organization_id)
  )
);

drop policy if exists "madar v2 workspace access gate" on public.integration_write_conflicts;
create policy "madar v2 workspace access gate"
on public.integration_write_conflicts
as restrictive
for select
to authenticated
using (
  exists (
    select 1
    from public.integration_write_commands command
    where command.id = command_id
      and private.has_v2_workspace_access(command.organization_id)
  )
);

drop policy if exists "madar v2 workspace access gate" on public.integration_compensations;
create policy "madar v2 workspace access gate"
on public.integration_compensations
as restrictive
for select
to authenticated
using (
  exists (
    select 1
    from public.integration_write_commands command
    where command.id = command_id
      and private.has_v2_workspace_access(command.organization_id)
  )
);

drop policy if exists "madar v2 workspace access gate" on public.integration_reverse_sync_records;
create policy "madar v2 workspace access gate"
on public.integration_reverse_sync_records
as restrictive
for select
to authenticated
using (
  exists (
    select 1
    from public.integration_write_commands command
    where command.id = command_id
      and private.has_v2_workspace_access(command.organization_id)
  )
);

comment on function private.has_v2_workspace_access(uuid) is
'Restrictive RLS predicate for MADAR V2 operational data. Billing and subscription recovery tables intentionally remain outside this policy.';
