create or replace function private.assert_v2_organization_membership(
  target_organization uuid,
  require_manager boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  member_role public.organization_role;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists(
    select 1 from public.profiles profile
    where profile.id=actor and profile.status='active'
  ) then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;

  select membership.role into member_role
  from public.organization_members membership
  where membership.organization_id=target_organization and membership.user_id=actor;

  if member_role is null then raise exception 'ORGANIZATION_ACCESS_DENIED'; end if;
  if require_manager and member_role not in ('OWNER','ADMIN') then
    raise exception 'ORGANIZATION_MANAGER_REQUIRED';
  end if;

  return actor;
end;
$$;

revoke all on function private.assert_v2_organization_membership(uuid, boolean) from public, anon, authenticated;

comment on function private.assert_v2_organization_membership(uuid, boolean) is
'Organization membership guard for the current account-first model. A profile remains PERSONAL after registration and gains commercial access through explicit organization membership and an active service, not by mutating profile.account_type.';