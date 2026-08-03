-- MADAR V2.0 production transition snapshot.
-- This migration intentionally runs immediately before the P0-P11 migration.
-- It preserves the membership and subscription edges that the exclusive V2
-- account model may detach, without exposing the snapshot to client roles.

create schema if not exists private;

create table if not exists public.v2_transition_membership_backups (
  id bigint generated always as identity primary key,
  release_version text not null default '2.0',
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null,
  organization_type text not null,
  organization_status text not null,
  membership_created_at timestamptz,
  captured_at timestamptz not null default now(),
  restored_at timestamptz,
  restore_reason text,
  unique(release_version,organization_id,user_id)
);

create table if not exists public.v2_transition_subscription_backups (
  id bigint generated always as identity primary key,
  release_version text not null default '2.0',
  organization_id uuid not null references public.organizations(id) on delete restrict,
  workspace_subscription_id uuid not null,
  snapshot jsonb not null,
  captured_at timestamptz not null default now(),
  unique(release_version,workspace_subscription_id)
);

insert into public.v2_transition_membership_backups(
  release_version,organization_id,user_id,role,organization_type,
  organization_status,membership_created_at
)
select '2.0',m.organization_id,m.user_id,m.role,o.type,o.status,m.created_at
from public.organization_members m
join public.organizations o on o.id=m.organization_id and o.type='STUDENT'
where exists(
  select 1
  from public.organization_members commercial_membership
  join public.organizations commercial_org
    on commercial_org.id=commercial_membership.organization_id
   and commercial_org.type<>'STUDENT'
  where commercial_membership.user_id=m.user_id
)
on conflict(release_version,organization_id,user_id) do nothing;

insert into public.v2_transition_subscription_backups(
  release_version,organization_id,workspace_subscription_id,snapshot
)
select '2.0',s.organization_id,s.id,to_jsonb(s)
from public.workspace_subscriptions s
on conflict(release_version,workspace_subscription_id) do nothing;

alter table public.v2_transition_membership_backups enable row level security;
alter table public.v2_transition_subscription_backups enable row level security;

revoke all on public.v2_transition_membership_backups from anon,authenticated;
revoke all on public.v2_transition_subscription_backups from anon,authenticated;
grant select,insert,update on public.v2_transition_membership_backups to service_role;
grant select,insert on public.v2_transition_subscription_backups to service_role;
grant usage,select on sequence public.v2_transition_membership_backups_id_seq to service_role;
grant usage,select on sequence public.v2_transition_subscription_backups_id_seq to service_role;

create or replace function private.restore_v2_student_membership(
  p_user_id uuid,
  p_organization_id uuid,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  backup public.v2_transition_membership_backups%rowtype;
begin
  if coalesce(length(trim(p_reason)),0)<8 then
    raise exception 'RESTORE_REASON_REQUIRED';
  end if;

  select * into backup
  from public.v2_transition_membership_backups
  where release_version='2.0'
    and user_id=p_user_id
    and organization_id=p_organization_id
  for update;

  if not found then
    raise exception 'V2_TRANSITION_BACKUP_NOT_FOUND';
  end if;

  insert into public.organization_members(organization_id,user_id,role,created_at)
  values(backup.organization_id,backup.user_id,backup.role,coalesce(backup.membership_created_at,now()))
  on conflict(organization_id,user_id) do update set role=excluded.role;

  update public.organizations
  set status=case when backup.organization_status='archived' then 'active' else backup.organization_status end,
      updated_at=now()
  where id=backup.organization_id;

  update public.v2_transition_membership_backups
  set restored_at=now(),restore_reason=p_reason
  where id=backup.id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(null,'v2.transition.student_membership_restored','organization',backup.organization_id,
    jsonb_build_object('user_id',backup.user_id,'reason',p_reason,'backup_id',backup.id));

  return true;
end;
$$;

revoke all on function private.restore_v2_student_membership(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.restore_v2_student_membership(uuid,uuid,text) to service_role;
