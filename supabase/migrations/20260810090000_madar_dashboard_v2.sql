-- MADAR Dashboard V2: confirmed, tenant-safe daily actions shared by web and mobile.
-- The application never writes a business row directly. Every mutation is
-- previewed, expires, is confirmed once, checked for conflicts and audited.

create table if not exists public.mobile_action_commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  action_type text not null check(action_type in ('TASK_STATUS_UPDATE','KITCHEN_TICKET_STATUS','HOUSEKEEPING_STATUS')),
  entity_type text not null,
  entity_id text not null,
  source_of_truth text not null check(source_of_truth in ('MADAR','EXTERNAL')),
  connection_id uuid references public.integration_connections(id) on delete set null,
  external_command_id uuid references public.integration_write_commands(id) on delete set null,
  before_snapshot jsonb not null default '{}'::jsonb,
  desired_change jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  result jsonb,
  idempotency_key text not null check(char_length(idempotency_key) between 8 and 160),
  status text not null default 'PREVIEWED' check(status in ('PREVIEWED','QUEUED','EXECUTED','REJECTED','EXPIRED','CONFLICT','FAILED')),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  confirmed_at timestamptz,
  completed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,idempotency_key)
);

create index if not exists mobile_action_commands_user_created_idx on public.mobile_action_commands(user_id,organization_id,created_at desc);
create index if not exists mobile_action_commands_status_idx on public.mobile_action_commands(organization_id,status,updated_at desc);
create index if not exists mobile_action_commands_connection_idx on public.mobile_action_commands(connection_id) where connection_id is not null;
create index if not exists mobile_action_commands_external_idx on public.mobile_action_commands(external_command_id) where external_command_id is not null;

alter table public.mobile_action_commands enable row level security;
drop policy if exists "members read own mobile actions" on public.mobile_action_commands;
create policy "members read own mobile actions" on public.mobile_action_commands for select to authenticated
using(user_id=(select auth.uid()) and private.is_organization_member(organization_id));

revoke all on table public.mobile_action_commands from public,anon,authenticated;
grant select on table public.mobile_action_commands to authenticated;

create or replace function private.preview_mobile_action_v2_impl(
  target_organization uuid,
  action_type text,
  entity_id text,
  desired_change jsonb,
  idempotency_key text,
  target_connection uuid default null
) returns public.mobile_action_commands
language plpgsql security definer set search_path='' as $$
declare
  actor uuid; organization public.organizations; command public.mobile_action_commands;
  snapshot jsonb; normalized_action text:=upper(trim(action_type)); next_status text:=upper(trim(coalesce(desired_change->>'status','')));
  resource_key text; entity_name text; connection uuid; external_command public.integration_write_commands;
begin
  actor:=private.assert_v2_organization_access(target_organization,true);
  if char_length(trim(idempotency_key)) not between 8 and 160 then raise exception 'MOBILE_IDEMPOTENCY_KEY_INVALID'; end if;
  if jsonb_typeof(desired_change)<>'object' then raise exception 'MOBILE_DESIRED_CHANGE_INVALID'; end if;
  if not exists(
    select 1 from public.pricing_subscription_snapshots subscription
    where subscription.organization_id=target_organization and subscription.status in ('trialing','active')
      and coalesce((subscription.locked_entitlements->>'orby_write_tools')::boolean,false)
  ) then raise exception 'MOBILE_WRITE_ENTITLEMENT_REQUIRED'; end if;
  select * into organization from public.organizations where id=target_organization and status='active';
  if organization.id is null then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;

  case normalized_action
    when 'TASK_STATUS_UPDATE' then
      if lower(next_status) not in ('todo','in_progress','done','cancelled') then raise exception 'INVALID_TASK_STATUS'; end if;
      select to_jsonb(task) into snapshot from public.business_tasks task where task.id=trim(entity_id)::uuid and task.organization_id=target_organization;
      resource_key:='TASK_UPDATE';entity_name:='business_task';next_status:=lower(next_status);
    when 'KITCHEN_TICKET_STATUS' then
      if next_status not in ('PREPARING','READY','SERVED','CANCELLED') then raise exception 'INVALID_KITCHEN_STATUS'; end if;
      select to_jsonb(ticket) into snapshot from public.restaurant_kitchen_tickets ticket where ticket.id=trim(entity_id)::uuid and ticket.organization_id=target_organization;
      resource_key:='RESTAURANT_ORDER_STATUS';entity_name:='kitchen_ticket';
    when 'HOUSEKEEPING_STATUS' then
      if next_status not in ('ASSIGNED','IN_PROGRESS','INSPECTION','COMPLETED','BLOCKED') then raise exception 'INVALID_HOUSEKEEPING_STATUS'; end if;
      select to_jsonb(task) into snapshot from public.hotel_housekeeping_tasks task where task.id=trim(entity_id)::uuid and task.organization_id=target_organization;
      resource_key:='HOUSEKEEPING_STATUS';entity_name:='housekeeping_task';
    else raise exception 'MOBILE_ACTION_NOT_ALLOWED';
  end case;
  if snapshot is null then raise exception 'MOBILE_ACTION_ENTITY_NOT_FOUND'; end if;

  -- Serialize equal idempotency keys so a concurrent retry cannot create or
  -- alter a second downstream connector preview before the first commits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_organization::text||':'||trim(idempotency_key),0));
  select * into command from public.mobile_action_commands existing where existing.organization_id=target_organization and existing.idempotency_key=trim(idempotency_key);
  if command.id is not null then
    if command.user_id<>actor or command.action_type<>normalized_action or command.entity_id<>trim(entity_id)
      or command.desired_change->>'status' is distinct from next_status
      or (target_connection is not null and command.connection_id is distinct from target_connection)
    then raise exception 'MOBILE_IDEMPOTENCY_CONFLICT'; end if;
    return command;
  end if;

  if organization.source_of_truth='EXTERNAL' or organization.operating_mode='CONNECTED_EXTERNAL' then
    if not coalesce((select (subscription.locked_entitlements->>'reverse_write')::boolean from public.pricing_subscription_snapshots subscription where subscription.organization_id=target_organization and subscription.status in ('trialing','active') order by subscription.created_at desc limit 1),false) then raise exception 'ENTITLEMENT_REVERSE_WRITE_REQUIRED'; end if;
    select grant_row.connection_id into connection from public.integration_permission_grants grant_row join public.integration_connections linked on linked.id=grant_row.connection_id
    where grant_row.organization_id=target_organization and grant_row.resource_key=resource_key and grant_row.permission='WRITE' and grant_row.revoked_at is null and linked.deleted_at is null
      and (target_connection is null or grant_row.connection_id=target_connection) order by grant_row.granted_at desc limit 1;
    if connection is null then raise exception 'WRITE_PERMISSION_REQUIRED'; end if;
    external_command:=private.preview_integration_write_impl(target_organization,connection,'STATUS_UPDATE',resource_key,entity_name,trim(entity_id),jsonb_build_object('status',next_status),null,'mobile:'||trim(idempotency_key));
  end if;

  insert into public.mobile_action_commands(organization_id,user_id,action_type,entity_type,entity_id,source_of_truth,connection_id,external_command_id,before_snapshot,desired_change,preview,idempotency_key)
  values(target_organization,actor,normalized_action,entity_name,trim(entity_id),case when connection is null then 'MADAR' else 'EXTERNAL' end,connection,external_command.id,snapshot,jsonb_build_object('status',next_status),
    jsonb_build_object('title',case normalized_action when 'TASK_STATUS_UPDATE' then 'تحديث حالة المهمة' when 'KITCHEN_TICKET_STATUS' then 'تحديث تذكرة المطبخ' else 'تحديث مهمة التنظيف' end,'entity_type',entity_name,'entity_id',trim(entity_id),'before',jsonb_build_object('status',snapshot->>'status'),'after',jsonb_build_object('status',next_status),'source_of_truth',case when connection is null then 'MADAR' else 'EXTERNAL' end,'requires_confirmation',true),trim(idempotency_key)) returning * into command;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,'mobile.action.previewed','mobile_action_command',command.id,jsonb_build_object('organization_id',target_organization,'target_entity_type',entity_name,'target_entity_id',entity_id,'before',jsonb_build_object('status',snapshot->>'status'),'after',command.desired_change,'source_of_truth',command.source_of_truth));
  return command;
end $$;

revoke all on function private.preview_mobile_action_v2_impl(uuid,text,text,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function private.preview_mobile_action_v2_impl(uuid,text,text,jsonb,text,uuid) to authenticated;
create or replace function public.preview_mobile_action_v2(target_organization uuid,action_type text,entity_id text,desired_change jsonb,idempotency_key text,target_connection uuid default null)
returns public.mobile_action_commands language sql security invoker set search_path='' as $$
 select private.preview_mobile_action_v2_impl(target_organization,action_type,entity_id,desired_change,idempotency_key,target_connection)
$$;
revoke all on function public.preview_mobile_action_v2(uuid,text,text,jsonb,text,uuid) from public,anon;
grant execute on function public.preview_mobile_action_v2(uuid,text,text,jsonb,text,uuid) to authenticated;

create or replace function private.decide_mobile_action_v2_impl(target_action uuid,decision text)
returns public.mobile_action_commands language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); command public.mobile_action_commands; current_status text; external_command public.integration_write_commands;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into command from public.mobile_action_commands where id=target_action and user_id=actor for update;
  if command.id is null then raise exception 'MOBILE_ACTION_NOT_FOUND'; end if;
  perform private.assert_v2_organization_access(command.organization_id,true);
  if command.status<>'PREVIEWED' then raise exception 'MOBILE_ACTION_NOT_CONFIRMABLE'; end if;
  if command.expires_at<=now() then
    if command.external_command_id is not null then
      update public.integration_write_commands set status='CANCELLED',completed_at=now(),error_code='MOBILE_APPROVAL_EXPIRED' where id=command.external_command_id and status='PREVIEWED';
      insert into public.integration_consent_log(organization_id,connection_id,actor_id,action,resource_key,details) values(command.organization_id,command.connection_id,actor,'CANCEL',null,jsonb_build_object('command_id',command.external_command_id,'reason','approval_expired'));
    end if;
    update public.mobile_action_commands set status='EXPIRED',error_code='APPROVAL_EXPIRED',completed_at=now(),updated_at=now() where id=command.id returning * into command;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,'mobile.action.expired','mobile_action_command',command.id,jsonb_build_object('organization_id',command.organization_id,'target_entity_type',command.entity_type,'target_entity_id',command.entity_id));
    return command;
  end if;
  if lower(decision)='rejected' then
    if command.external_command_id is not null then
      update public.integration_write_commands set status='CANCELLED',completed_at=now(),error_code='MOBILE_APPROVAL_REJECTED' where id=command.external_command_id and status='PREVIEWED';
      insert into public.integration_consent_log(organization_id,connection_id,actor_id,action,resource_key,details) values(command.organization_id,command.connection_id,actor,'CANCEL',null,jsonb_build_object('command_id',command.external_command_id,'reason','user_rejected'));
    end if;
    update public.mobile_action_commands set status='REJECTED',completed_at=now(),updated_at=now() where id=command.id returning * into command;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,'mobile.action.rejected','mobile_action_command',command.id,jsonb_build_object('organization_id',command.organization_id,'target_entity_type',command.entity_type,'target_entity_id',command.entity_id,'before',jsonb_build_object('status',command.before_snapshot->>'status'),'rejected_change',command.desired_change));return command;
  end if;
  if lower(decision)<>'confirmed' then raise exception 'MOBILE_ACTION_DECISION_INVALID'; end if;

  if command.source_of_truth='EXTERNAL' then
    external_command:=private.confirm_integration_write_impl(command.organization_id,command.external_command_id);
    update public.mobile_action_commands set status='QUEUED',confirmed_at=now(),result=jsonb_build_object('external_command_id',external_command.id,'status',external_command.status),updated_at=now() where id=command.id returning * into command;
  else
    case command.action_type
      when 'TASK_STATUS_UPDATE' then
        select status into current_status from public.business_tasks where id=command.entity_id::uuid and organization_id=command.organization_id for update;
        if current_status is distinct from command.before_snapshot->>'status' then update public.mobile_action_commands set status='CONFLICT',error_code='SOURCE_VERSION_CONFLICT',completed_at=now(),updated_at=now() where id=command.id returning * into command;insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,'mobile.action.conflict','mobile_action_command',command.id,jsonb_build_object('organization_id',command.organization_id,'target_entity_type',command.entity_type,'target_entity_id',command.entity_id,'expected_status',command.before_snapshot->>'status','actual_status',current_status));return command;end if;
        update public.business_tasks set status=command.desired_change->>'status',updated_at=now() where id=command.entity_id::uuid and organization_id=command.organization_id returning status into current_status;
      when 'KITCHEN_TICKET_STATUS' then
        select status into current_status from public.restaurant_kitchen_tickets where id=command.entity_id::uuid and organization_id=command.organization_id for update;
        if current_status is distinct from command.before_snapshot->>'status' then update public.mobile_action_commands set status='CONFLICT',error_code='SOURCE_VERSION_CONFLICT',completed_at=now(),updated_at=now() where id=command.id returning * into command;insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,'mobile.action.conflict','mobile_action_command',command.id,jsonb_build_object('organization_id',command.organization_id,'target_entity_type',command.entity_type,'target_entity_id',command.entity_id,'expected_status',command.before_snapshot->>'status','actual_status',current_status));return command;end if;
        select updated.status into current_status from private.update_kitchen_ticket_impl(command.organization_id,command.entity_id::uuid,command.desired_change->>'status') updated;
      when 'HOUSEKEEPING_STATUS' then
        select status into current_status from public.hotel_housekeeping_tasks where id=command.entity_id::uuid and organization_id=command.organization_id for update;
        if current_status is distinct from command.before_snapshot->>'status' then update public.mobile_action_commands set status='CONFLICT',error_code='SOURCE_VERSION_CONFLICT',completed_at=now(),updated_at=now() where id=command.id returning * into command;insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,'mobile.action.conflict','mobile_action_command',command.id,jsonb_build_object('organization_id',command.organization_id,'target_entity_type',command.entity_type,'target_entity_id',command.entity_id,'expected_status',command.before_snapshot->>'status','actual_status',current_status));return command;end if;
        select updated.status into current_status from private.update_housekeeping_task_impl(command.organization_id,command.entity_id::uuid,command.desired_change->>'status',null) updated;
    end case;
    if current_status is distinct from command.desired_change->>'status' then raise exception 'MOBILE_VERIFICATION_FAILED'; end if;
    update public.mobile_action_commands set status='EXECUTED',confirmed_at=now(),completed_at=now(),result=jsonb_build_object('verified',true,'status',current_status),updated_at=now() where id=command.id returning * into command;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,'mobile.action.confirmed','mobile_action_command',command.id,jsonb_build_object('organization_id',command.organization_id,'target_entity_type',command.entity_type,'target_entity_id',command.entity_id,'before',jsonb_build_object('status',command.before_snapshot->>'status'),'after',command.desired_change,'source_of_truth',command.source_of_truth,'result',command.result));
  return command;
end $$;

revoke all on function private.decide_mobile_action_v2_impl(uuid,text) from public,anon,authenticated;
grant execute on function private.decide_mobile_action_v2_impl(uuid,text) to authenticated;
create or replace function public.decide_mobile_action_v2(target_action uuid,decision text)
returns public.mobile_action_commands language sql security invoker set search_path='' as $$select private.decide_mobile_action_v2_impl(target_action,decision)$$;
revoke all on function public.decide_mobile_action_v2(uuid,text) from public,anon;
grant execute on function public.decide_mobile_action_v2(uuid,text) to authenticated;

-- Reconcile external write state for display without allowing the client to alter it.
create or replace view public.mobile_action_status with (security_invoker=true) as
select command.*,
 case when command.status='PREVIEWED' and command.expires_at<=now() then 'EXPIRED'
      when command.source_of_truth='EXTERNAL' then coalesce(external.status,command.status)
      else command.status end effective_status,
 external.error_code external_error_code,external.completed_at external_completed_at
from public.mobile_action_commands command left join public.integration_write_commands external on external.id=command.external_command_id;
revoke all on public.mobile_action_status from public,anon;
grant select on public.mobile_action_status to authenticated;

do $$ begin
 if not exists(select 1 from pg_constraint where conname='mobile_action_commands_preview_shape_check') then
  alter table public.mobile_action_commands add constraint mobile_action_commands_preview_shape_check check(jsonb_typeof(preview)='object' and jsonb_typeof(desired_change)='object') not valid;
 end if;
end $$;
alter table public.mobile_action_commands validate constraint mobile_action_commands_preview_shape_check;
