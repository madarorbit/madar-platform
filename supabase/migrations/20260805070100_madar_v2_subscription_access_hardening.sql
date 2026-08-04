-- MADAR V2.0 — authoritative subscription access resolution.
-- V2 pricing snapshots are the only source of truth for commercial access.

create or replace function public.resolve_pricing_subscription_status(
  target_organization uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text := coalesce((select auth.role()), '');
  current_subscription public.pricing_subscription_snapshots%rowtype;
  resolved_status text;
begin
  if target_organization is null then
    raise exception 'ORGANIZATION_REQUIRED';
  end if;

  if current_role <> 'service_role' and not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization
      and membership.user_id = current_user_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select snapshot.*
  into current_subscription
  from public.pricing_subscription_snapshots snapshot
  where snapshot.organization_id = target_organization
  order by
    case when snapshot.status in ('trialing', 'active', 'past_due') then 0 else 1 end,
    snapshot.created_at desc
  limit 1
  for update;

  if current_subscription.id is null then
    return 'missing';
  end if;

  resolved_status := current_subscription.status;

  if current_subscription.status = 'trialing'
     and (
       current_subscription.trial_ends_at is null
       or current_subscription.trial_ends_at <= now()
     ) then
    resolved_status := 'expired';
  elsif current_subscription.status in ('active', 'past_due')
     and (
       current_subscription.ends_at is null
       or current_subscription.ends_at <= now()
     ) then
    resolved_status := 'expired';
  end if;

  if resolved_status = 'expired'
     and current_subscription.status is distinct from 'expired' then
    update public.pricing_subscription_snapshots
    set status = 'expired', updated_at = now()
    where id = current_subscription.id;

    update public.pricing_subscription_changes
    set status = 'cancelled'
    where subscription_snapshot_id = current_subscription.id
      and status = 'scheduled';
  end if;

  return resolved_status;
end;
$$;

revoke all on function public.resolve_pricing_subscription_status(uuid)
from public, anon, authenticated;
grant execute on function public.resolve_pricing_subscription_status(uuid)
to authenticated, service_role;

comment on function public.resolve_pricing_subscription_status(uuid) is
'MADAR V2.0 authoritative access gate. Resolves and persists expiry using PostgreSQL server time without falling back to V1 subscriptions.';
