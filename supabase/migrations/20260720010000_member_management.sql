-- Phase 2 follow-up: controlled member management without trusting browser-supplied user IDs.
create or replace function public.manage_organization_member(target_organization uuid, target_email text, requested_role public.organization_role default 'MEMBER', operation text default 'add') returns void language plpgsql security definer set search_path=public as $$
declare actor_role public.organization_role; target_user uuid; target_role public.organization_role; begin
 select role into actor_role from public.organization_members where organization_id=target_organization and user_id=auth.uid();
 if actor_role is null or actor_role not in ('OWNER','ADMIN') then raise exception 'Not authorized'; end if;
 select id into target_user from public.profiles where lower(email)=lower(trim(target_email));
 if target_user is null then raise exception 'User not found'; end if;
 select role into target_role from public.organization_members where organization_id=target_organization and user_id=target_user;
 if operation='add' then
   if target_role is not null then raise exception 'Member already exists'; end if;
   if actor_role='ADMIN' and requested_role <> 'MEMBER' then raise exception 'Admins may add members only'; end if;
   if requested_role='OWNER' then raise exception 'Ownership transfer is not available here'; end if;
   insert into public.organization_members(organization_id,user_id,role) values(target_organization,target_user,requested_role);
 elsif operation='remove' then
   if target_role is null then raise exception 'Member not found'; end if;
   if actor_role='ADMIN' and target_role <> 'MEMBER' then raise exception 'Admins may remove members only'; end if;
   delete from public.organization_members where organization_id=target_organization and user_id=target_user;
 else raise exception 'Invalid operation'; end if;
end; $$;
revoke all on function public.manage_organization_member(uuid,text,public.organization_role,text) from public;
grant execute on function public.manage_organization_member(uuid,text,public.organization_role,text) to authenticated;
