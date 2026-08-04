-- MADAR V2.0 — remove executable V1 subscription paths and make
-- pricing_subscription_snapshots.locked_entitlements authoritative.

revoke execute on function public.submit_subscription_renewal(uuid, uuid, text, text, text, text, bigint)
from authenticated;
revoke execute on function private.submit_subscription_renewal_impl(uuid, uuid, text, text, text, text, bigint)
from authenticated;
revoke execute on function public.review_subscription_renewal(uuid, text, text)
from authenticated;
revoke execute on function private.review_subscription_renewal_impl(uuid, text, text)
from authenticated;
revoke execute on function public.refresh_workspace_subscription(uuid)
from authenticated;
revoke execute on function private.refresh_workspace_subscription_impl(uuid)
from authenticated;

create or replace function private.v2_active_subscription_entitlement(
  target_organization uuid,
  entitlement_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot public.pricing_subscription_snapshots%rowtype;
  access_valid boolean := false;
begin
  if target_organization is null or nullif(trim(entitlement_key), '') is null then
    raise exception 'INVALID_ENTITLEMENT_REQUEST';
  end if;

  select subscription.*
  into snapshot
  from public.pricing_subscription_snapshots subscription
  where subscription.organization_id = target_organization
  order by
    case when subscription.status in ('trialing', 'active', 'past_due') then 0 else 1 end,
    subscription.created_at desc
  limit 1
  for update;

  if snapshot.id is null then
    raise exception 'V2_SUBSCRIPTION_REQUIRED';
  end if;

  access_valid :=
    (snapshot.status = 'trialing'
      and snapshot.trial_ends_at is not null
      and snapshot.trial_ends_at > now())
    or
    (snapshot.status in ('active', 'past_due')
      and snapshot.ends_at is not null
      and snapshot.ends_at > now());

  if not access_valid then
    if snapshot.status in ('trialing', 'active', 'past_due') then
      update public.pricing_subscription_snapshots
      set status = 'expired', updated_at = now()
      where id = snapshot.id;

      update public.pricing_subscription_changes
      set status = 'cancelled'
      where subscription_snapshot_id = snapshot.id
        and status = 'scheduled';
    end if;
    raise exception 'V2_SUBSCRIPTION_EXPIRED';
  end if;

  if not (snapshot.locked_entitlements ? entitlement_key) then
    raise exception 'V2_ENTITLEMENT_MISSING:%', entitlement_key;
  end if;

  return snapshot.locked_entitlements -> entitlement_key;
end;
$$;

revoke all on function private.v2_active_subscription_entitlement(uuid, text)
from public, anon, authenticated;

create or replace function private.enforce_workspace_product_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entitlement jsonb;
  allowed integer;
  current_count integer;
begin
  entitlement := private.v2_active_subscription_entitlement(
    new.organization_id,
    'products'
  );
  allowed := (entitlement #>> '{}')::integer;

  if allowed < 0 then
    return new;
  end if;
  if allowed < 1 then
    raise exception 'PRODUCT_LIMIT_DISABLED';
  end if;

  select count(*)
  into current_count
  from public.business_products product
  where product.organization_id = new.organization_id;

  if current_count >= allowed then
    raise exception 'PRODUCT_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_workspace_product_limit()
from public, anon, authenticated;

create or replace function private.enforce_workspace_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_type public.organization_type;
  entitlement jsonb;
  allowed integer;
  current_count integer;
begin
  select organization.type
  into organization_type
  from public.organizations organization
  where organization.id = new.organization_id;

  if organization_type = 'STUDENT' then
    return new;
  end if;

  -- The initial owner must be insertable before onboarding creates the V2 snapshot.
  if new.role = 'OWNER'
     and not exists (
       select 1
       from public.organization_members membership
       where membership.organization_id = new.organization_id
     ) then
    return new;
  end if;

  entitlement := private.v2_active_subscription_entitlement(
    new.organization_id,
    'team_members'
  );
  allowed := (entitlement #>> '{}')::integer;

  if allowed < 0 then
    return new;
  end if;
  if allowed < 1 then
    raise exception 'MEMBER_LIMIT_DISABLED';
  end if;

  select count(*)
  into current_count
  from public.organization_members membership
  where membership.organization_id = new.organization_id;

  if current_count >= allowed then
    raise exception 'MEMBER_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_workspace_member_limit()
from public, anon, authenticated;

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
  if current_user_id is null
     or not private.is_organization_member(target_organization) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if submitted_characters < 1 or submitted_characters > 12000 then
    raise exception 'INVALID_PROMPT_SIZE';
  end if;

  entitlement := private.v2_active_subscription_entitlement(
    target_organization,
    'orby_daily_messages'
  );
  daily_limit := (entitlement #>> '{}')::integer;

  if daily_limit = 0 then
    raise exception 'ORBY_NOT_INCLUDED';
  end if;
  if daily_limit < -1 then
    raise exception 'INVALID_ORBY_ENTITLEMENT';
  end if;

  character_ceiling := case
    when daily_limit = -1 then 10000000
    else greatest(100000, daily_limit * 5000)
  end;

  insert into public.orby_usage_daily(
    organization_id,
    user_id,
    usage_date,
    requests,
    input_characters
  )
  values(
    target_organization,
    current_user_id,
    current_date,
    1,
    submitted_characters
  )
  on conflict(organization_id, user_id, usage_date)
  do update set
    requests = public.orby_usage_daily.requests + 1,
    input_characters = public.orby_usage_daily.input_characters + excluded.input_characters,
    updated_at = now()
  where
    (daily_limit = -1 or public.orby_usage_daily.requests < daily_limit)
    and public.orby_usage_daily.input_characters + excluded.input_characters <= character_ceiling
  returning * into usage_row;

  if usage_row.user_id is null then
    raise exception 'ORBY_DAILY_LIMIT';
  end if;

  return jsonb_build_object(
    'requests', usage_row.requests,
    'limit', daily_limit,
    'remaining', case
      when daily_limit = -1 then -1
      else greatest(daily_limit - usage_row.requests, 0)
    end,
    'input_characters', usage_row.input_characters,
    'source', 'MADAR_V2_LOCKED_ENTITLEMENTS'
  );
end;
$$;

comment on function private.v2_active_subscription_entitlement(uuid, text) is
'Authoritative MADAR V2 entitlement resolver. It uses server time, persists expiry, and never reads V1 subscription plans.';
comment on function private.enforce_workspace_product_limit() is
'Enforces product limits from the active MADAR V2 locked entitlement snapshot.';
comment on function private.enforce_workspace_member_limit() is
'Enforces team member limits from the active MADAR V2 locked entitlement snapshot.';
comment on function private.consume_orby_quota_impl(uuid, integer) is
'Consumes ORBY quota using MADAR V2 locked entitlements; -1 means unlimited requests with an operational character ceiling.';
