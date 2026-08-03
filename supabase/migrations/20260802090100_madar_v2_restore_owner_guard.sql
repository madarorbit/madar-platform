-- Restore the permanent strict owner invariant immediately after P0-P11 has
-- detached the snapshotted legacy student memberships.
create or replace function private.prevent_last_organization_owner()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.role='OWNER'
     and (tg_op='DELETE' or new.role<>'OWNER')
     and not exists(
       select 1
       from public.organization_members
       where organization_id=old.organization_id
         and user_id<>old.user_id
         and role='OWNER'
     ) then
    raise exception 'An organization must retain an owner';
  end if;
  return coalesce(new,old);
end;
$$;

revoke all on function private.prevent_last_organization_owner() from public,anon,authenticated;
