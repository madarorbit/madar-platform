create or replace function private.has_v2_workspace_access(target_organization uuid)
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
  profile_active boolean := false;
  active_account_service boolean := false;
begin
  if current_user_id is null then return false; end if;
  if private.is_admin() then return true; end if;

  if not exists(
    select 1 from public.organization_members membership
    where membership.organization_id = target_organization
      and membership.user_id = current_user_id
  ) then return false; end if;

  select organization.type into organization_type
  from public.organizations organization where organization.id = target_organization;
  if organization_type is null then return false; end if;

  select exists(
    select 1 from public.profiles profile
    where profile.id = current_user_id and profile.status = 'active'
  ) into profile_active;
  if not profile_active then return false; end if;

  if organization_type = 'STUDENT' then
    return exists(
      select 1 from public.profiles profile
      where profile.id=current_user_id and profile.status='active' and profile.account_type='PERSONAL'
    );
  end if;

  select subscription.* into snapshot
  from public.pricing_subscription_snapshots subscription
  where subscription.organization_id=target_organization
  order by case when subscription.status in ('trialing','active','past_due') then 0 else 1 end,
           subscription.created_at desc
  limit 1;

  if snapshot.id is not null then
    if coalesce((snapshot.locked_entitlements->>'workspace_access')::boolean,false) is not true then return false; end if;
    return (snapshot.status='trialing' and snapshot.trial_ends_at is not null and snapshot.trial_ends_at>now())
      or (snapshot.status in ('active','past_due') and snapshot.ends_at is not null and snapshot.ends_at>now());
  end if;

  select exists(
    select 1
    from public.workspace_subscriptions subscription
    join public.subscription_plans plan on plan.id=subscription.plan_id
    where subscription.organization_id=target_organization
      and subscription.user_id=current_user_id
      and subscription.activation_state='ACTIVE'
      and subscription.status in ('active','past_due')
      and subscription.ends_at is not null and subscription.ends_at>now()
      and plan.is_active and plan.is_available
  ) into active_account_service;

  return active_account_service;
end;
$$;

revoke all on function private.has_v2_workspace_access(uuid) from public, anon, authenticated;

comment on function private.has_v2_workspace_access(uuid) is
'Workspace access guard compatible with both legacy V2 locked snapshots and the current account-service activation model. Commercial workspace ownership does not require mutating the account profile from PERSONAL to BUSINESS.';