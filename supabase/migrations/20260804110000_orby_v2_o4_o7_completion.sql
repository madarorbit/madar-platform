-- ORBY V2.0 — O4 through O7 completion layer.
-- Additive only. This migration is intentionally committed without applying it remotely.

create table if not exists public.orby_vertical_installations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vertical_key text not null check(vertical_key in ('commerce','food_service','hospitality','student','personal')),
  plugin_version text not null,
  plan_level text not null check(plan_level in ('BASIC','PREMIUM','FULL')),
  status text not null default 'active' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
  terminology jsonb not null default '{}'::jsonb,
  kpis jsonb not null default '[]'::jsonb,
  tool_allowlist jsonb not null default '[]'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  installed_by uuid references public.profiles(id) on delete set null,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,vertical_key)
);

create table if not exists public.orby_source_of_truth_states (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  operating_mode text not null check(operating_mode in ('MADAR_NATIVE','CONNECTED_EXTERNAL')),
  source_of_truth text not null check(source_of_truth in ('MADAR','EXTERNAL')),
  connector_id text references public.integration_connectors(connector_key) on delete set null,
  connector_authorized boolean not null default false,
  last_synced_at timestamptz,
  allowed_write_operations jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orby_cross_device_state (
  conversation_id uuid primary key references public.orby_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check(channel in ('web','mobile','in_app')),
  state_version bigint not null default 1 check(state_version>0),
  last_message_id uuid references public.orby_messages(id) on delete set null,
  active_run_id uuid references public.orby_workflow_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.orby_admin_control_versions (
  id uuid primary key default gen_random_uuid(),
  resource_kind text not null check(resource_kind in ('provider','model','prompt','tool','capability','plan_limit','policy')),
  resource_key text not null,
  version text not null,
  enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  reason text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(resource_kind,resource_key,version)
);

create table if not exists public.orby_release_gate_runs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.orby_os_releases(id) on delete cascade,
  core_version text not null,
  status text not null check(status in ('running','passed','failed','cancelled')),
  gate_results jsonb not null default '[]'::jsonb,
  score numeric(6,5) not null default 0 check(score between 0 and 1),
  artifact_refs jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.orby_data_governance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check(request_type in ('export','delete','correct')),
  scope jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check(status in ('pending','approved','processing','completed','rejected','cancelled')),
  decision_reason text,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.orby_backup_manifests (
  id uuid primary key default gen_random_uuid(),
  backup_version text not null,
  components jsonb not null,
  encrypted boolean not null check(encrypted),
  checksum text not null,
  storage_region text not null,
  status text not null default 'created' check(status in ('created','verified','restore_tested','failed','expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  restore_tested_at timestamptz
);

create table if not exists public.orby_channel_registry (
  channel_key text primary key check(channel_key in ('in_app','mobile','push','email','whatsapp','webhook')),
  name_ar text not null,
  status text not null check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
  supports_inbound boolean not null default false,
  supports_outbound boolean not null default false,
  permissions jsonb not null default '[]'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.orby_channel_registry(channel_key,name_ar,status,supports_inbound,supports_outbound,permissions,configuration) values
 ('in_app','مَدار داخل المنصة','active',true,true,'["orby.chat"]'::jsonb,'{"kernel":"shared"}'::jsonb),
 ('mobile','تطبيق مَدار','active',true,true,'["orby.chat"]'::jsonb,'{"kernel":"shared"}'::jsonb),
 ('push','إشعارات التطبيق','active',false,true,'["notifications.receive"]'::jsonb,'{"kernel":"shared"}'::jsonb),
 ('email','البريد الإلكتروني','paused',false,true,'["notifications.receive"]'::jsonb,'{"future":true}'::jsonb),
 ('whatsapp','واتساب','paused',false,false,'["channel.whatsapp"]'::jsonb,'{"future":true,"requires_security_review":true}'::jsonb),
 ('webhook','Webhook','paused',false,false,'["channel.webhook"]'::jsonb,'{"future":true,"requires_security_review":true}'::jsonb)
on conflict(channel_key) do update set name_ar=excluded.name_ar,status=excluded.status,supports_inbound=excluded.supports_inbound,supports_outbound=excluded.supports_outbound,permissions=excluded.permissions,configuration=excluded.configuration,updated_at=now();

create index if not exists orby_vertical_installations_org_status_idx on public.orby_vertical_installations(organization_id,status);
create index if not exists orby_cross_device_state_scope_idx on public.orby_cross_device_state(organization_id,user_id,updated_at desc);
create index if not exists orby_admin_control_versions_resource_idx on public.orby_admin_control_versions(resource_kind,resource_key,created_at desc);
create index if not exists orby_release_gate_runs_release_idx on public.orby_release_gate_runs(release_id,started_at desc);
create index if not exists orby_data_governance_requests_scope_idx on public.orby_data_governance_requests(organization_id,user_id,status,requested_at desc);

alter table public.orby_vertical_installations enable row level security;
alter table public.orby_source_of_truth_states enable row level security;
alter table public.orby_cross_device_state enable row level security;
alter table public.orby_admin_control_versions enable row level security;
alter table public.orby_release_gate_runs enable row level security;
alter table public.orby_data_governance_requests enable row level security;
alter table public.orby_backup_manifests enable row level security;
alter table public.orby_channel_registry enable row level security;

drop policy if exists orby_vertical_installations_members_read on public.orby_vertical_installations;
create policy orby_vertical_installations_members_read on public.orby_vertical_installations for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=orby_vertical_installations.organization_id and m.user_id=auth.uid())
);
drop policy if exists orby_source_of_truth_members_read on public.orby_source_of_truth_states;
create policy orby_source_of_truth_members_read on public.orby_source_of_truth_states for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=orby_source_of_truth_states.organization_id and m.user_id=auth.uid())
);
drop policy if exists orby_cross_device_owner_rw on public.orby_cross_device_state;
create policy orby_cross_device_owner_rw on public.orby_cross_device_state for all to authenticated using (
 user_id=auth.uid() and exists(select 1 from public.organization_members m where m.organization_id=orby_cross_device_state.organization_id and m.user_id=auth.uid())
) with check (
 user_id=auth.uid() and exists(select 1 from public.organization_members m where m.organization_id=orby_cross_device_state.organization_id and m.user_id=auth.uid())
);
drop policy if exists orby_data_governance_owner_read on public.orby_data_governance_requests;
create policy orby_data_governance_owner_read on public.orby_data_governance_requests for select to authenticated using (
 user_id=auth.uid() and exists(select 1 from public.organization_members m where m.organization_id=orby_data_governance_requests.organization_id and m.user_id=auth.uid())
);
drop policy if exists orby_data_governance_owner_create on public.orby_data_governance_requests;
create policy orby_data_governance_owner_create on public.orby_data_governance_requests for insert to authenticated with check (
 user_id=auth.uid() and exists(select 1 from public.organization_members m where m.organization_id=orby_data_governance_requests.organization_id and m.user_id=auth.uid())
);
drop policy if exists orby_channel_registry_authenticated_read on public.orby_channel_registry;
create policy orby_channel_registry_authenticated_read on public.orby_channel_registry for select to authenticated using (true);

drop policy if exists orby_vertical_installations_service on public.orby_vertical_installations;
create policy orby_vertical_installations_service on public.orby_vertical_installations for all to service_role using (true) with check (true);
drop policy if exists orby_source_of_truth_service on public.orby_source_of_truth_states;
create policy orby_source_of_truth_service on public.orby_source_of_truth_states for all to service_role using (true) with check (true);
drop policy if exists orby_cross_device_service on public.orby_cross_device_state;
create policy orby_cross_device_service on public.orby_cross_device_state for all to service_role using (true) with check (true);
drop policy if exists orby_admin_control_versions_service on public.orby_admin_control_versions;
create policy orby_admin_control_versions_service on public.orby_admin_control_versions for all to service_role using (true) with check (true);
drop policy if exists orby_release_gate_runs_service on public.orby_release_gate_runs;
create policy orby_release_gate_runs_service on public.orby_release_gate_runs for all to service_role using (true) with check (true);
drop policy if exists orby_data_governance_service on public.orby_data_governance_requests;
create policy orby_data_governance_service on public.orby_data_governance_requests for all to service_role using (true) with check (true);
drop policy if exists orby_backup_manifests_service on public.orby_backup_manifests;
create policy orby_backup_manifests_service on public.orby_backup_manifests for all to service_role using (true) with check (true);
drop policy if exists orby_channel_registry_service on public.orby_channel_registry;
create policy orby_channel_registry_service on public.orby_channel_registry for all to service_role using (true) with check (true);

revoke all on public.orby_admin_control_versions,public.orby_release_gate_runs,public.orby_backup_manifests from authenticated;
grant select on public.orby_vertical_installations,public.orby_source_of_truth_states,public.orby_channel_registry to authenticated;
grant select,insert,update on public.orby_cross_device_state to authenticated;
grant select,insert on public.orby_data_governance_requests to authenticated;
grant select,insert,update,delete on public.orby_vertical_installations,public.orby_source_of_truth_states,public.orby_cross_device_state,public.orby_admin_control_versions,public.orby_release_gate_runs,public.orby_data_governance_requests,public.orby_backup_manifests,public.orby_channel_registry to service_role;
