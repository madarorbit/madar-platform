begin;

create table if not exists public.mobile_v2_settings (
  id smallint primary key default 1 check (id = 1),
  external_writes_enabled boolean not null default false,
  stale_after_seconds integer not null default 300 check (stale_after_seconds between 30 and 86400),
  max_attachment_bytes integer not null default 5242880 check (max_attachment_bytes between 1024 and 20971520),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.mobile_v2_settings(id) values (1) on conflict (id) do nothing;

create table if not exists public.mobile_command_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in (
    'TASK_COMPLETE','TASK_REOPEN','TASK_RESCHEDULE','TASK_NOTE','ALERT_ACKNOWLEDGE','ALERT_HIDE','FOLLOWUP_CREATE',
    'CUSTOMER_NOTE','ORDER_STATUS_UPDATE','INVENTORY_ADJUST','FOLLOWUP_STATUS_UPDATE'
  )),
  target_type text,
  target_id text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 160),
  execution_path text not null check (execution_path in ('MADAR_NATIVE','CONNECTED_EXTERNAL')),
  status text not null default 'previewed' check (status in ('previewed','queued','sending','executed','synced','failed','needs_review','cancelled')),
  summary text not null default '',
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  blocked_reason text,
  integration_command_id uuid references public.integration_write_commands(id) on delete set null,
  system_confirmed boolean not null default false,
  madar_synced boolean not null default false,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  unique (organization_id, requested_by, idempotency_key)
);
create index if not exists mobile_command_requests_org_updated_idx on public.mobile_command_requests(organization_id, updated_at desc, id desc);
create index if not exists mobile_command_requests_integration_idx on public.mobile_command_requests(integration_command_id) where integration_command_id is not null;

create table if not exists public.mobile_alert_states (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id text not null,
  acknowledged_at timestamptz,
  hidden_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, alert_id)
);

create table if not exists public.mobile_task_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.business_tasks(id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists mobile_task_notes_task_idx on public.mobile_task_notes(organization_id, task_id, created_at desc);

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null check (char_length(token) between 20 and 500),
  platform text not null check (platform in ('android','ios')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists mobile_push_tokens_org_idx on public.mobile_push_tokens(organization_id, enabled) where enabled;

create table if not exists public.mobile_orby_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 240),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf','text/plain')),
  byte_size integer not null check (byte_size between 1 and 20971520),
  status text not null default 'uploaded' check (status in ('uploaded','attached','rejected','deleted')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists mobile_orby_attachments_org_idx on public.mobile_orby_attachments(organization_id, created_at desc);

create or replace function private.touch_mobile_v2_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists mobile_v2_settings_touch on public.mobile_v2_settings;
create trigger mobile_v2_settings_touch before update on public.mobile_v2_settings for each row execute function private.touch_mobile_v2_updated_at();
drop trigger if exists mobile_command_requests_touch on public.mobile_command_requests;
create trigger mobile_command_requests_touch before update on public.mobile_command_requests for each row execute function private.touch_mobile_v2_updated_at();
drop trigger if exists mobile_push_tokens_touch on public.mobile_push_tokens;
create trigger mobile_push_tokens_touch before update on public.mobile_push_tokens for each row execute function private.touch_mobile_v2_updated_at();

create or replace function public.mobile_v2_preview_command(
  target_organization uuid,
  submitted_action text,
  target_type text default null,
  target_id text default null,
  submitted_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := private.assert_v2_organization_access(target_organization, false);
  action_name text := upper(btrim(coalesce(submitted_action,'')));
  operation_mode text;
  external_enabled boolean;
  connection_ready boolean;
  result_summary text;
  warnings jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(coalesce(submitted_payload,'{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_COMMAND_PAYLOAD';
  end if;
  if action_name in ('PRICE_CHANGE','PAYMENT_TRANSFER','SENSITIVE_DELETE','TEAM_MANAGEMENT','CONNECTOR_PERMISSION_CHANGE','CONNECTOR_CREDENTIAL_CHANGE','BULK_WRITE') then
    return jsonb_build_object('allowed',false,'blockedReason','هذا النوع من العمليات محظور داخل تطبيق مَدار V2.0.','executionPath','BLOCKED','summary','عملية محظورة','warnings','[]'::jsonb);
  end if;
  if action_name in ('TASK_COMPLETE','TASK_REOPEN','TASK_RESCHEDULE','TASK_NOTE','ALERT_ACKNOWLEDGE','ALERT_HIDE','FOLLOWUP_CREATE') then
    result_summary := case action_name
      when 'TASK_COMPLETE' then 'إكمال المهمة المحددة'
      when 'TASK_REOPEN' then 'إعادة فتح المهمة المحددة'
      when 'TASK_RESCHEDULE' then 'تغيير موعد المهمة المحددة'
      when 'TASK_NOTE' then 'إضافة ملاحظة داخلية إلى المهمة'
      when 'ALERT_ACKNOWLEDGE' then 'تأكيد قراءة التنبيه'
      when 'ALERT_HIDE' then 'إخفاء التنبيه لهذا المستخدم'
      else 'إنشاء متابعة جديدة داخل مَدار'
    end;
    return jsonb_build_object('allowed',true,'blockedReason',null,'executionPath','MADAR_NATIVE','summary',result_summary,'warnings',warnings);
  end if;
  if action_name not in ('CUSTOMER_NOTE','ORDER_STATUS_UPDATE','INVENTORY_ADJUST','FOLLOWUP_STATUS_UPDATE') then
    return jsonb_build_object('allowed',false,'blockedReason','الأمر المطلوب غير مدعوم في التطبيق.','executionPath','BLOCKED','summary','أمر غير مدعوم','warnings','[]'::jsonb);
  end if;
  select operating_mode into operation_mode from public.organizations where id=target_organization and status='active';
  if operation_mode is distinct from 'CONNECTED_EXTERNAL' then
    return jsonb_build_object('allowed',false,'blockedReason','هذا الأمر الخارجي متاح فقط لمساحة تعمل عبر نظام مرتبط.','executionPath','BLOCKED','summary','مسار تشغيل غير متوافق','warnings','[]'::jsonb);
  end if;
  select external_writes_enabled into external_enabled from public.mobile_v2_settings where id=1;
  if not coalesce(external_enabled,false) then
    return jsonb_build_object('allowed',false,'blockedReason','الكتابة إلى الأنظمة الخارجية مغلقة أمنيًا حتى اجتياز تجربة الربط الفعلية.','executionPath','CONNECTED_EXTERNAL','summary','الكتابة الخارجية غير مفعلة','warnings',jsonb_build_array('لن يرسل مَدار أي تغيير إلى نظام العميل.'));
  end if;
  select exists(
    select 1 from public.integration_connections
    where organization_id=target_organization and status='active' and connection_mode='WRITE_LIMITED' and deleted_at is null
  ) into connection_ready;
  if not connection_ready then
    return jsonb_build_object('allowed',false,'blockedReason','لا يوجد Connector نشط بصلاحية كتابة محدودة لهذه المساحة.','executionPath','CONNECTED_EXTERNAL','summary','Connector غير جاهز للكتابة','warnings','[]'::jsonb);
  end if;
  warnings := jsonb_build_array('سيُرسل الأمر إلى نظام العميل بعد التأكيد.','لن يظهر نجاح قبل تحقق النظام ثم مزامنة مَدار.');
  result_summary := case action_name
    when 'CUSTOMER_NOTE' then 'إضافة ملاحظة إلى سجل العميل في النظام المرتبط'
    when 'ORDER_STATUS_UPDATE' then 'تحديث حالة الطلب في النظام المرتبط'
    when 'INVENTORY_ADJUST' then 'تعديل كمية مخزون محددة في النظام المرتبط'
    else 'تحديث حالة المتابعة في النظام المرتبط'
  end;
  return jsonb_build_object('allowed',true,'blockedReason',null,'executionPath','CONNECTED_EXTERNAL','summary',result_summary,'warnings',warnings);
end $$;

create or replace function public.mobile_v2_apply_command(
  target_organization uuid,
  submitted_action text,
  target_type text default null,
  target_id text default null,
  submitted_payload jsonb default '{}'::jsonb,
  submitted_idempotency_key text default null,
  preview_summary text default ''
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.assert_v2_organization_access(target_organization, false);
  action_name text := upper(btrim(coalesce(submitted_action,'')));
  payload_value jsonb := coalesce(submitted_payload,'{}'::jsonb);
  preview jsonb;
  existing public.mobile_command_requests;
  command_row public.mobile_command_requests;
  task_uuid uuid;
  task_note text;
  due_value timestamptz;
  followup_title text;
  followup_priority text;
  connection_row public.integration_connections;
  integration_id uuid;
  operation_message text;
begin
  if submitted_idempotency_key is null or char_length(submitted_idempotency_key) not between 8 and 160 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  select * into existing from public.mobile_command_requests
    where organization_id=target_organization and requested_by=actor and idempotency_key=submitted_idempotency_key;
  if found then
    return jsonb_build_object(
      'operation', jsonb_build_object('id',existing.id,'action',existing.action,'label',existing.summary,'status',existing.status,'targetType',existing.target_type,'targetId',existing.target_id,'createdAt',existing.created_at,'updatedAt',existing.updated_at,'message',existing.message),
      'systemConfirmed', existing.system_confirmed,
      'madarSynced', existing.madar_synced
    );
  end if;
  preview := public.mobile_v2_preview_command(target_organization,action_name,target_type,target_id,payload_value);
  if not coalesce((preview->>'allowed')::boolean,false) then
    raise exception 'MOBILE_COMMAND_BLOCKED: %', coalesce(preview->>'blockedReason','غير مسموح');
  end if;

  insert into public.mobile_command_requests(organization_id,requested_by,action,target_type,target_id,payload,idempotency_key,execution_path,status,summary,warnings,confirmed_at)
  values(target_organization,actor,action_name,nullif(btrim(target_type),''),nullif(btrim(target_id),''),payload_value,submitted_idempotency_key,preview->>'executionPath','sending',coalesce(nullif(btrim(preview_summary),''),preview->>'summary'),coalesce(preview->'warnings','[]'::jsonb),now())
  returning * into command_row;

  if action_name in ('TASK_COMPLETE','TASK_REOPEN','TASK_RESCHEDULE','TASK_NOTE') then
    if target_id is null or target_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'INVALID_TASK_ID'; end if;
    task_uuid := target_id::uuid;
    if action_name='TASK_COMPLETE' then
      update public.business_tasks set status='done',updated_at=now() where id=task_uuid and organization_id=target_organization;
    elsif action_name='TASK_REOPEN' then
      update public.business_tasks set status='todo',updated_at=now() where id=task_uuid and organization_id=target_organization;
    elsif action_name='TASK_RESCHEDULE' then
      begin due_value := nullif(payload_value->>'dueAt','')::timestamptz; exception when others then raise exception 'INVALID_DUE_DATE'; end;
      if due_value is null then raise exception 'INVALID_DUE_DATE'; end if;
      update public.business_tasks set due_at=due_value,updated_at=now() where id=task_uuid and organization_id=target_organization;
    else
      task_note := btrim(coalesce(payload_value->>'note',''));
      if char_length(task_note) not between 1 and 2000 then raise exception 'INVALID_TASK_NOTE'; end if;
      if not exists(select 1 from public.business_tasks where id=task_uuid and organization_id=target_organization) then raise exception 'TASK_NOT_FOUND'; end if;
      insert into public.mobile_task_notes(organization_id,task_id,note,created_by) values(target_organization,task_uuid,task_note,actor);
    end if;
    if action_name <> 'TASK_NOTE' and not found then raise exception 'TASK_NOT_FOUND'; end if;
    operation_message := 'تم التنفيذ داخل مَدار وتحديث لوحة القيادة.';

  elsif action_name in ('ALERT_ACKNOWLEDGE','ALERT_HIDE') then
    if nullif(btrim(target_id),'') is null then raise exception 'INVALID_ALERT_ID'; end if;
    insert into public.mobile_alert_states(organization_id,user_id,alert_id,acknowledged_at,hidden_at)
    values(target_organization,actor,target_id,case when action_name='ALERT_ACKNOWLEDGE' then now() else null end,case when action_name='ALERT_HIDE' then now() else null end)
    on conflict(organization_id,user_id,alert_id) do update set
      acknowledged_at=case when action_name='ALERT_ACKNOWLEDGE' then now() else public.mobile_alert_states.acknowledged_at end,
      hidden_at=case when action_name='ALERT_HIDE' then now() else public.mobile_alert_states.hidden_at end,
      updated_at=now();
    operation_message := case when action_name='ALERT_ACKNOWLEDGE' then 'تم تأكيد قراءة التنبيه.' else 'تم إخفاء التنبيه لهذا الحساب.' end;

  elsif action_name='FOLLOWUP_CREATE' then
    followup_title := btrim(coalesce(payload_value->>'title','متابعة من تطبيق مَدار'));
    if char_length(followup_title) not between 1 and 220 then raise exception 'INVALID_FOLLOWUP_TITLE'; end if;
    followup_priority := lower(coalesce(payload_value->>'priority','medium'));
    if followup_priority not in ('low','medium','high','urgent') then followup_priority := 'medium'; end if;
    begin due_value := nullif(payload_value->>'dueAt','')::timestamptz; exception when others then raise exception 'INVALID_DUE_DATE'; end;
    insert into public.business_tasks(organization_id,title,description,priority,status,due_at,created_by)
    values(target_organization,followup_title,nullif(btrim(payload_value->>'description'),''),followup_priority,'todo',due_value,actor);
    operation_message := 'تم إنشاء المتابعة داخل مَدار.';

  else
    select * into connection_row from public.integration_connections
      where organization_id=target_organization and status='active' and connection_mode='WRITE_LIMITED' and deleted_at is null
      order by last_success_at desc nulls last, created_at asc limit 1;
    if connection_row.id is null then raise exception 'WRITE_CONNECTOR_NOT_READY'; end if;
    insert into public.integration_write_commands(
      organization_id,connection_id,command_type,resource_key,entity_type,entity_id,desired_change,preview,idempotency_key,status,requested_by,confirmed_by,confirmed_at
    ) values(
      target_organization,connection_row.id,action_name,lower(action_name),coalesce(nullif(btrim(target_type),''),'record'),coalesce(nullif(btrim(target_id),''),'unknown'),payload_value,
      jsonb_build_object('source','MADAR_MOBILE_V2','mobileCommandId',command_row.id,'summary',command_row.summary,'warnings',command_row.warnings),
      'mobile:'||submitted_idempotency_key,'CONFIRMED',actor,actor,now()
    ) returning id into integration_id;
    update public.mobile_command_requests set status='queued',integration_command_id=integration_id,message='تم تأكيد الأمر ووضعه في طابور Connector. لا يزال التنفيذ قيد التحقق.' where id=command_row.id returning * into command_row;
    return jsonb_build_object(
      'operation', jsonb_build_object('id',command_row.id,'action',command_row.action,'label',command_row.summary,'status',command_row.status,'targetType',command_row.target_type,'targetId',command_row.target_id,'createdAt',command_row.created_at,'updatedAt',command_row.updated_at,'message',command_row.message),
      'systemConfirmed',false,
      'madarSynced',false
    );
  end if;

  update public.mobile_command_requests set status='synced',system_confirmed=true,madar_synced=true,message=operation_message,completed_at=now()
  where id=command_row.id returning * into command_row;
  return jsonb_build_object(
    'operation', jsonb_build_object('id',command_row.id,'action',command_row.action,'label',command_row.summary,'status',command_row.status,'targetType',command_row.target_type,'targetId',command_row.target_id,'createdAt',command_row.created_at,'updatedAt',command_row.updated_at,'message',command_row.message),
    'systemConfirmed',true,
    'madarSynced',true
  );
exception when others then
  if command_row.id is not null then
    update public.mobile_command_requests set status='failed',message='فشل التنفيذ بأمان ولم يُعرض نجاح.',completed_at=now() where id=command_row.id;
  end if;
  raise;
end $$;

create or replace function private.sync_mobile_command_from_integration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare mapped_status text; confirmed boolean := false; synced boolean := false; status_message text;
begin
  mapped_status := case new.status
    when 'PREVIEWED' then 'previewed'
    when 'CONFIRMED' then 'queued'
    when 'QUEUED' then 'queued'
    when 'EXECUTING' then 'sending'
    when 'VERIFYING' then 'executed'
    when 'SUCCEEDED' then 'synced'
    when 'CONFLICT' then 'needs_review'
    when 'FAILED' then 'failed'
    when 'COMPENSATING' then 'needs_review'
    when 'COMPENSATED' then 'failed'
    when 'CANCELLED' then 'cancelled'
    else 'needs_review'
  end;
  confirmed := new.status in ('VERIFYING','SUCCEEDED');
  synced := new.status='SUCCEEDED';
  status_message := case mapped_status
    when 'queued' then 'تم تأكيد الأمر وينتظر الإرسال عبر Connector.'
    when 'sending' then 'جاري الإرسال إلى نظام العميل.'
    when 'executed' then 'أكد النظام الخارجي التنفيذ، وتنتظر مزامنة مَدار.'
    when 'synced' then 'تم التنفيذ في النظام وتمت مزامنة مَدار.'
    when 'needs_review' then 'ظهرت حالة تعارض أو مراجعة، ولم يُعرض نجاح.'
    when 'failed' then coalesce(new.error_message,'فشل التنفيذ في النظام الخارجي.')
    when 'cancelled' then 'أُلغي الأمر قبل اكتمال التنفيذ.'
    else 'تم تحديث حالة العملية.'
  end;
  update public.mobile_command_requests set
    status=mapped_status,
    system_confirmed=confirmed,
    madar_synced=synced,
    message=status_message,
    completed_at=case when mapped_status in ('synced','failed','cancelled') then coalesce(new.completed_at,now()) else null end
  where integration_command_id=new.id;
  return new;
end $$;

drop trigger if exists integration_write_commands_mobile_status on public.integration_write_commands;
create trigger integration_write_commands_mobile_status after insert or update of status,error_message,completed_at on public.integration_write_commands
for each row execute function private.sync_mobile_command_from_integration();

alter table public.mobile_v2_settings enable row level security;
alter table public.mobile_command_requests enable row level security;
alter table public.mobile_alert_states enable row level security;
alter table public.mobile_task_notes enable row level security;
alter table public.mobile_push_tokens enable row level security;
alter table public.mobile_orby_attachments enable row level security;

create policy mobile_command_requests_member_select on public.mobile_command_requests for select to authenticated using (private.is_organization_member(organization_id));
create policy mobile_alert_states_owner_all on public.mobile_alert_states for all to authenticated using (user_id=(select auth.uid()) and private.is_organization_member(organization_id)) with check (user_id=(select auth.uid()) and private.is_organization_member(organization_id));
create policy mobile_task_notes_member_select on public.mobile_task_notes for select to authenticated using (private.is_organization_member(organization_id));
create policy mobile_push_tokens_owner_all on public.mobile_push_tokens for all to authenticated using (user_id=(select auth.uid()) and private.is_organization_member(organization_id)) with check (user_id=(select auth.uid()) and private.is_organization_member(organization_id));
create policy mobile_orby_attachments_owner_select on public.mobile_orby_attachments for select to authenticated using (user_id=(select auth.uid()) and private.is_organization_member(organization_id));
create policy mobile_orby_attachments_owner_insert on public.mobile_orby_attachments for insert to authenticated with check (user_id=(select auth.uid()) and private.is_organization_member(organization_id));

revoke all on public.mobile_v2_settings from anon, authenticated;
grant select on public.mobile_v2_settings to authenticated;
grant select on public.mobile_command_requests to authenticated;
grant select on public.mobile_task_notes to authenticated;
grant select,insert,update on public.mobile_alert_states to authenticated;
grant select,insert,update on public.mobile_push_tokens to authenticated;
grant select,insert on public.mobile_orby_attachments to authenticated;
revoke all on function public.mobile_v2_preview_command(uuid,text,text,text,jsonb) from public, anon;
revoke all on function public.mobile_v2_apply_command(uuid,text,text,text,jsonb,text,text) from public, anon;
grant execute on function public.mobile_v2_preview_command(uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.mobile_v2_apply_command(uuid,text,text,text,jsonb,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mobile-orby-attachments','mobile-orby-attachments',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists mobile_orby_storage_insert on storage.objects;
create policy mobile_orby_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='mobile-orby-attachments'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and private.is_organization_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists mobile_orby_storage_select on storage.objects;
create policy mobile_orby_storage_select on storage.objects for select to authenticated using (
  bucket_id='mobile-orby-attachments'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and private.is_organization_member(((storage.foldername(name))[1])::uuid)
);

commit;
