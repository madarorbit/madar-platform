-- Temporarily permit only the two kinds of membership detachments that were
-- snapshotted for the MADAR V2 exclusive account transition. The existing
-- owner invariant remains enforced for every other organization and member.
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
    if tg_op='DELETE'
       and exists(
         select 1
         from public.v2_transition_membership_backups backup
         join public.organizations student_org
           on student_org.id=backup.organization_id
          and student_org.type='STUDENT'
         where backup.release_version='2.0'
           and backup.organization_id=old.organization_id
           and backup.user_id=old.user_id
           and backup.restored_at is null
           and exists(
             select 1
             from public.organization_members commercial_membership
             join public.organizations commercial_org
               on commercial_org.id=commercial_membership.organization_id
              and commercial_org.type<>'STUDENT'
             where commercial_membership.user_id=old.user_id
           )
       ) then
      return old;
    end if;
    raise exception 'An organization must retain an owner';
  end if;
  return coalesce(new,old);
end;
$$;

revoke all on function private.prevent_last_organization_owner() from public,anon,authenticated;
