-- One-off production operation for the Account + Services launch.
-- Run only after deleting the listed Beta storage objects through the Storage API.
-- The transaction aborts unless the exact founder identity and profile are present.

begin;

do $$
declare
  expected_founder constant uuid := '7ae3ef1a-8d9a-4d4b-a428-e03c2eb3199e';
  founder_id uuid;
  founder_count integer;
  auth_count_before integer;
  profile_count_before integer;
  organization_count_before integer;
  subscription_count_before integer;
  request_count_before integer;
begin
  select count(*), (array_agg(id))[1]
  into founder_count, founder_id
  from auth.users
  where lower(email) = 'orbit.ops.digital@gmail.com';

  if founder_count <> 1 or founder_id is distinct from expected_founder then
    raise exception 'FOUNDER_GUARD_FAILED';
  end if;
  if not exists (select 1 from public.profiles where id = founder_id) then
    raise exception 'FOUNDER_PROFILE_MISSING';
  end if;
  if exists (
    select 1
    from storage.objects
    where owner_id is distinct from founder_id::text
       or bucket_id = 'student-library'
  ) then
    raise exception 'BETA_STORAGE_OBJECTS_REMAIN';
  end if;

  select count(*) into auth_count_before from auth.users;
  select count(*) into profile_count_before from public.profiles;
  select count(*) into organization_count_before from public.organizations;
  select count(*) into subscription_count_before from public.workspace_subscriptions;
  select count(*) into request_count_before from public.workspace_requests;

  update public.profiles
  set role = 'SUPER_ADMIN', status = 'active', updated_at = now()
  where id = founder_id;

  -- Requests and subscriptions may no longer have an organization during setup,
  -- so remove them explicitly before the organization graph.
  delete from public.workspace_requests;
  delete from public.subscription_renewal_requests;
  delete from public.workspace_subscriptions;
  delete from public.v2_transition_membership_backups;
  delete from public.v2_transition_subscription_backups;

  -- The owner-preservation trigger protects normal product flows. This scoped
  -- maintenance transaction temporarily disables it so the complete Beta
  -- workspace graph can be removed, then restores it immediately.
  alter table public.organization_members
    disable trigger organization_owner_required;
  delete from public.organization_members;
  delete from public.organizations;
  alter table public.organization_members
    enable trigger organization_owner_required;

  -- One Beta-authored global post is not organization-scoped and otherwise
  -- correctly blocks removal of its author profile.
  delete from public.blog_posts where author_id <> founder_id;

  -- Profile cascades clear account-owned rows; Auth cascades clear identities,
  -- sessions, MFA and other auth records. Restrictive references were verified
  -- after the organization deletion before this operation was approved.
  delete from public.profiles where id <> founder_id;
  delete from auth.users where id <> founder_id;

  if (select count(*) from auth.users) <> 1 then
    raise exception 'AUTH_CLEANUP_FAILED';
  end if;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'PROFILE_CLEANUP_FAILED';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = founder_id and role = 'SUPER_ADMIN' and status = 'active'
  ) then
    raise exception 'FOUNDER_ADMIN_GUARD_FAILED';
  end if;
  if exists (select 1 from public.organizations) then
    raise exception 'ORGANIZATION_CLEANUP_FAILED';
  end if;
  if exists (select 1 from public.workspace_subscriptions) then
    raise exception 'SUBSCRIPTION_CLEANUP_FAILED';
  end if;
  if exists (select 1 from public.workspace_requests) then
    raise exception 'REQUEST_CLEANUP_FAILED';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    founder_id,
    'platform.beta_data_cleanup.completed',
    'profile',
    founder_id,
    jsonb_build_object(
      'retained_email', 'orbit.ops.digital@gmail.com',
      'auth_users_before', auth_count_before,
      'auth_users_deleted', auth_count_before - 1,
      'profiles_before', profile_count_before,
      'profiles_deleted', profile_count_before - 1,
      'organizations_deleted', organization_count_before,
      'subscriptions_deleted', subscription_count_before,
      'requests_deleted', request_count_before
    )
  );
end
$$;

commit;
