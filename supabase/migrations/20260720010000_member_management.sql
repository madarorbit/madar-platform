-- Phase 2 follow-up: controlled membership operations and privacy-safe member listing.
create or replace function public.manage_organization_member(
 target_organization uuid,
 target_email text,
 requested_role public.organization_role default 'MEMBER',
 operation text default 'add'
) returns void language plpgsql security definer set search_path='' as $$
declare actor_role public.organization_role; target_user uuid; target_role public.organization_role;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select role into actor_role from public.organization_members
 where organization_id=target_organization and user_id=(select auth.uid());
 if actor_role is null or actor_role not in ('OWNER','ADMIN') then raise exception 'Not authorized'; end if;
 select id into target_user from public.profiles where lower(email)=lower(trim(target_email));
 if target_user is null then raise exception 'User not found'; end if;
 select role into target_role from public.organization_members
 where organization_id=target_organization and user_id=target_user;
 if operation='add' then
   if target_role is not null then raise exception 'Member already exists'; end if;
   if actor_role='ADMIN' and requested_role <> 'MEMBER' then raise exception 'Admins may add members only'; end if;
   if requested_role='OWNER' then raise exception 'Ownership transfer is not available here'; end if;
   insert into public.organization_members(organization_id,user_id,role)
   values(target_organization,target_user,requested_role);
 elsif operation='remove' then
   if target_role is null then raise exception 'Member not found'; end if;
   if actor_role='ADMIN' and target_role <> 'MEMBER' then raise exception 'Admins may remove members only'; end if;
   if target_user=(select auth.uid()) then raise exception 'You cannot remove yourself'; end if;
   delete from public.organization_members where organization_id=target_organization and user_id=target_user;
 else raise exception 'Invalid operation'; end if;
end; $$;

create or replace function public.list_organization_members(target_organization uuid)
returns table(user_id uuid, email text, full_name text, role public.organization_role, created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select m.user_id,p.email,p.full_name,m.role,m.created_at
 from public.organization_members m join public.profiles p on p.id=m.user_id
 where m.organization_id=target_organization
   and private.is_organization_member(target_organization)
 order by m.created_at asc
$$;

revoke all on function public.manage_organization_member(uuid,text,public.organization_role,text) from public, anon;
revoke all on function public.list_organization_members(uuid) from public, anon;
grant execute on function public.manage_organization_member(uuid,text,public.organization_role,text) to authenticated;
grant execute on function public.list_organization_members(uuid) to authenticated;
