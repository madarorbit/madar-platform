-- MADAR V2.0 — founder subscription control and operational overview.
-- Retires write access to the V1 subscription adjustment RPC without deleting history.

revoke execute on function public.founder_adjust_subscription(uuid, integer, text, boolean)
from authenticated;
revoke execute on function private.founder_adjust_subscription_impl(uuid, integer, text, boolean)
from authenticated;

create or replace function private.founder_adjust_v2_subscription_impl(
  target_organization uuid,
  days_delta integer,
  requested_status text
)
returns public.pricing_subscription_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot public.pricing_subscription_snapshots%rowtype;
  previous_status text;
  previous_end timestamptz;
  adjusted_end timestamptz;
begin
  if not private.is_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIRED';
  end if;
  if target_organization is null then
    raise exception 'ORGANIZATION_REQUIRED';
  end if;
  if days_delta not between -3650 and 3650 then
    raise exception 'INVALID_DAY_ADJUSTMENT';
  end if;
  if requested_status not in ('active', 'past_due', 'expired', 'cancelled') then
    raise exception 'INVALID_SUBSCRIPTION_STATUS';
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
    raise exception 'V2_SUBSCRIPTION_NOT_FOUND';
  end if;

  previous_status := snapshot.status;
  previous_end := snapshot.ends_at;
  adjusted_end := coalesce(snapshot.ends_at, snapshot.trial_ends_at, now())
    + (days_delta || ' days')::interval;

  if requested_status in ('active', 'past_due') then
    adjusted_end := case
      when days_delta > 0 then greatest(coalesce(snapshot.ends_at, snapshot.trial_ends_at, now()), now())
        + (days_delta || ' days')::interval
      else adjusted_end
    end;
    if adjusted_end <= now() then
      raise exception 'ACTIVE_SUBSCRIPTION_REQUIRES_FUTURE_END';
    end if;
  end if;

  update public.pricing_subscription_snapshots
  set
    status = requested_status,
    starts_at = case
      when requested_status = 'active' and previous_status in ('expired', 'cancelled') then now()
      else starts_at
    end,
    ends_at = adjusted_end,
    updated_at = now()
  where id = snapshot.id
  returning * into snapshot;

  if requested_status in ('expired', 'cancelled') then
    update public.pricing_subscription_changes
    set status = 'cancelled'
    where subscription_snapshot_id = snapshot.id
      and status = 'scheduled';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    (select auth.uid()),
    'founder.v2_subscription.adjusted',
    'pricing_subscription_snapshot',
    snapshot.id,
    jsonb_build_object(
      'organization_id', target_organization,
      'days_delta', days_delta,
      'previous_status', previous_status,
      'new_status', snapshot.status,
      'previous_end', previous_end,
      'new_end', snapshot.ends_at,
      'version', '2.0'
    )
  );

  insert into public.notifications(user_id, title, body, link)
  select distinct
    membership.user_id,
    'تم تحديث اشتراك مساحة العمل',
    format(
      'حدّث مؤسس مَدار حالة الاشتراك إلى %s، وتاريخ الانتهاء إلى %s.',
      snapshot.status,
      to_char(snapshot.ends_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI UTC')
    ),
    '/account/subscription'
  from public.organization_members membership
  where membership.organization_id = target_organization
    and membership.role in ('OWNER', 'ADMIN');

  return snapshot;
end;
$$;

revoke all on function private.founder_adjust_v2_subscription_impl(uuid, integer, text)
from public, anon, authenticated;
grant execute on function private.founder_adjust_v2_subscription_impl(uuid, integer, text)
to authenticated;

create or replace function public.founder_adjust_v2_subscription(
  target_organization uuid,
  days_delta integer,
  requested_status text
)
returns public.pricing_subscription_snapshots
language sql
security invoker
set search_path = ''
as $$
  select private.founder_adjust_v2_subscription_impl(
    target_organization,
    days_delta,
    requested_status
  )
$$;

revoke all on function public.founder_adjust_v2_subscription(uuid, integer, text)
from public, anon;
grant execute on function public.founder_adjust_v2_subscription(uuid, integer, text)
to authenticated;

create or replace function private.founder_platform_overview_impl()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest_subscriptions jsonb;
  revenue_by_currency jsonb;
begin
  if not private.is_super_admin() then
    raise exception 'SUPER_ADMIN_REQUIRED';
  end if;

  select jsonb_build_object(
    'total', count(*),
    'trialing', count(*) filter (where current_subscription.status = 'trialing'),
    'active', count(*) filter (where current_subscription.status = 'active'),
    'past_due', count(*) filter (where current_subscription.status = 'past_due'),
    'expired', count(*) filter (where current_subscription.status = 'expired'),
    'cancelled', count(*) filter (where current_subscription.status = 'cancelled')
  )
  into latest_subscriptions
  from (
    select distinct on (organization_id) organization_id, status
    from public.pricing_subscription_snapshots
    order by organization_id, created_at desc
  ) current_subscription;

  select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
  into revenue_by_currency
  from (
    select currency, round(sum(amount), 2) total
    from public.pricing_local_payment_requests
    where status = 'approved'
    group by currency
  ) approved_revenue;

  return jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'active', (select count(*) from public.profiles where status = 'active'),
      'admins', (select count(*) from public.profiles where role in ('ADMIN', 'SUPER_ADMIN'))
    ),
    'workspaces', jsonb_build_object(
      'total', (select count(*) from public.organizations where type <> 'STUDENT'),
      'active', (select count(*) from public.organizations where type <> 'STUDENT' and status = 'active'),
      'suspended', (select count(*) from public.organizations where type <> 'STUDENT' and status = 'suspended'),
      'without_v2_subscription', (
        select count(*)
        from public.organizations organization
        where organization.type <> 'STUDENT'
          and not exists (
            select 1
            from public.pricing_subscription_snapshots subscription
            where subscription.organization_id = organization.id
          )
      )
    ),
    'subscriptions', latest_subscriptions || jsonb_build_object(
      'pending_payments', (
        select count(*)
        from public.pricing_local_payment_requests
        where status = 'under_review'
      ),
      'approved_revenue', revenue_by_currency
    ),
    'store', jsonb_build_object(
      'products', (select count(*) from public.products),
      'services', (select count(*) from public.services),
      'orders', (select count(*) from public.orders),
      'approved_revenue', (select coalesce(sum(total), 0) from public.orders where payment_status = 'approved')
    ),
    'operations', jsonb_build_object(
      'pending_workspace_requests', (
        select count(*) from public.workspace_requests where status = 'pending_review'
      ),
      'open_feedback', (
        select count(*) from public.platform_feedback where status in ('new', 'reviewing', 'planned')
      ),
      'privacy_requests', (
        select count(*) from public.data_privacy_requests where status in ('requested', 'processing')
      ),
      'integration_incidents', (
        select count(*) from public.integration_health_incidents where status in ('open', 'acknowledged')
      )
    ),
    'generated_at', now()
  );
end;
$$;

comment on function public.founder_adjust_v2_subscription(uuid, integer, text) is
'MADAR V2.0 founder-only subscription adjustment. Operates exclusively on pricing subscription snapshots and records every change.';
