create or replace function private.orby_active_entitlement(
  target_organization uuid,
  entitlement_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_v2_snapshot boolean := false;
  active_plan public.subscription_plans%rowtype;
  requested_key text := nullif(trim(entitlement_key), '');
  orby_enabled boolean := false;
begin
  if target_organization is null or requested_key is null then
    raise exception 'INVALID_ORBY_ENTITLEMENT_REQUEST';
  end if;

  select exists(
    select 1
    from public.pricing_subscription_snapshots snapshot
    where snapshot.organization_id = target_organization
  ) into has_v2_snapshot;

  if has_v2_snapshot then
    return private.v2_active_subscription_entitlement(target_organization, requested_key);
  end if;

  select plan.*
  into active_plan
  from public.workspace_subscriptions subscription
  join public.subscription_plans plan on plan.id = subscription.plan_id
  where subscription.organization_id = target_organization
    and subscription.activation_state = 'ACTIVE'
    and subscription.status in ('active', 'past_due')
    and subscription.ends_at is not null
    and subscription.ends_at > now()
    and plan.is_active
    and plan.is_available
  order by subscription.updated_at desc, subscription.id desc
  limit 1;

  if active_plan.id is null then
    raise exception 'ORBY_SUBSCRIPTION_REQUIRED';
  end if;

  if requested_key = 'workspace_access' then
    return 'true'::jsonb;
  end if;

  if requested_key = 'orby_daily_messages' then
    orby_enabled := coalesce((active_plan.features ->> 'orby')::boolean, false);
    if not orby_enabled then return '0'::jsonb; end if;
    return to_jsonb(greatest(coalesce(active_plan.orby_daily_limit, 0), 0));
  end if;

  raise exception 'ORBY_ENTITLEMENT_MISSING:%', requested_key;
end;
$$;

revoke all on function private.orby_active_entitlement(uuid, text) from public, anon, authenticated;

create or replace function private.consume_orby_quota_impl(
  target_organization uuid,
  submitted_characters integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  usage_row public.orby_usage_daily%rowtype;
  entitlement jsonb;
  daily_limit integer;
  character_ceiling integer;
begin
  if current_user_id is null or not private.is_organization_member(target_organization) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if submitted_characters < 1 or submitted_characters > 12000 then
    raise exception 'INVALID_PROMPT_SIZE';
  end if;

  entitlement := private.orby_active_entitlement(target_organization, 'orby_daily_messages');
  daily_limit := (entitlement #>> '{}')::integer;
  if daily_limit = 0 then raise exception 'ORBY_NOT_INCLUDED'; end if;
  if daily_limit < -1 then raise exception 'INVALID_ORBY_ENTITLEMENT'; end if;

  character_ceiling := case when daily_limit = -1 then 10000000 else greatest(100000, daily_limit * 5000) end;

  insert into public.orby_usage_daily(organization_id,user_id,usage_date,requests,input_characters)
  values(target_organization,current_user_id,current_date,1,submitted_characters)
  on conflict(organization_id,user_id,usage_date)
  do update set requests=public.orby_usage_daily.requests+1,
                input_characters=public.orby_usage_daily.input_characters+excluded.input_characters,
                updated_at=now()
  where (daily_limit=-1 or public.orby_usage_daily.requests<daily_limit)
    and public.orby_usage_daily.input_characters+excluded.input_characters<=character_ceiling
  returning * into usage_row;

  if usage_row.user_id is null then raise exception 'ORBY_DAILY_LIMIT'; end if;

  return jsonb_build_object(
    'requests',usage_row.requests,
    'limit',daily_limit,
    'remaining',case when daily_limit=-1 then -1 else greatest(daily_limit-usage_row.requests,0) end,
    'input_characters',usage_row.input_characters,
    'source',case when exists(select 1 from public.pricing_subscription_snapshots s where s.organization_id=target_organization)
      then 'MADAR_V2_LOCKED_ENTITLEMENTS' else 'MADAR_ACCOUNT_SERVICE_PLAN' end
  );
end;
$$;

create or replace function public.orby_business_context(target_organization uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare workspace_access jsonb;
begin
  perform private.assert_v2_organization_membership(target_organization,false);
  workspace_access := private.orby_active_entitlement(target_organization,'workspace_access');
  if coalesce((workspace_access #>> '{}')::boolean,false) is not true then
    raise exception 'ORBY_WORKSPACE_ACCESS_DISABLED';
  end if;
  return private.orby_business_context_impl(target_organization);
end;
$$;

revoke all on function public.orby_business_context(uuid) from public, anon;
grant execute on function public.orby_business_context(uuid) to authenticated;

comment on function private.orby_active_entitlement(uuid, text) is
'ORBY entitlement bridge: prefers an existing MADAR V2 locked snapshot, otherwise uses the active account-service workspace subscription without inventing a V2 pricing variant.';