-- ORBY Stage 4: Expansion, Governance & ORBY OS v1
-- Administrative control plane only. Provider execution, OCR and external channels remain disabled.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.orby_os_releases (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 component text not null check(component in ('core','plugin','workflow','prompt','tool','model_config','knowledge_schema')),
 component_key text not null,
 version text not null,
 status text not null default 'draft' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
 rollout_percentage integer not null default 0 check(rollout_percentage between 0 and 100),
 previous_version text,
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 activated_at timestamptz,
 scope_key text generated always as (coalesce(organization_id::text,'global')) stored,
 unique(component,component_key,version,scope_key)
);
create index if not exists orby_os_releases_org_idx on public.orby_os_releases(organization_id,created_at desc) where organization_id is not null;
create index if not exists orby_os_releases_created_by_idx on public.orby_os_releases(created_by) where created_by is not null;

create table if not exists public.orby_feature_flags (
 id uuid primary key default gen_random_uuid(),
 key text not null,
 organization_id uuid references public.organizations(id) on delete cascade,
 workspace_id uuid,
 user_id uuid references auth.users(id) on delete cascade,
 environment text check(environment is null or environment in ('development','preview','production')),
 enabled boolean not null default false,
 rollout_percentage integer not null default 0 check(rollout_percentage between 0 and 100),
 starts_at timestamptz,
 ends_at timestamptz,
 configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'),
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 scope_key text generated always as (coalesce(environment,'*')||':'||coalesce(organization_id::text,'*')||':'||coalesce(workspace_id::text,'*')||':'||coalesce(user_id::text,'*')) stored,
 unique(key,scope_key),
 check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create index if not exists orby_feature_flags_org_idx on public.orby_feature_flags(organization_id,key) where organization_id is not null;
create index if not exists orby_feature_flags_workspace_idx on public.orby_feature_flags(workspace_id,key) where workspace_id is not null;
create index if not exists orby_feature_flags_user_idx on public.orby_feature_flags(user_id,key) where user_id is not null;
create index if not exists orby_feature_flags_updated_by_idx on public.orby_feature_flags(updated_by) where updated_by is not null;

create table if not exists public.orby_workflow_definitions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 key text not null,
 name text not null,
 description text not null,
 domain text not null,
 status text not null default 'draft' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
 required_permissions jsonb not null default '[]'::jsonb check(jsonb_typeof(required_permissions)='array'),
 tags jsonb not null default '[]'::jsonb check(jsonb_typeof(tags)='array'),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 scope_key text generated always as (coalesce(organization_id::text,'global')) stored,
 unique(key,scope_key)
);
create index if not exists orby_workflow_definitions_org_idx on public.orby_workflow_definitions(organization_id,domain,status) where organization_id is not null;
create index if not exists orby_workflow_definitions_created_by_idx on public.orby_workflow_definitions(created_by) where created_by is not null;

create table if not exists public.orby_workflow_versions (
 id uuid primary key default gen_random_uuid(),
 workflow_id uuid not null references public.orby_workflow_definitions(id) on delete cascade,
 version integer not null check(version>0),
 definition jsonb not null check(jsonb_typeof(definition)='object'),
 input_schema jsonb not null default '{}'::jsonb check(jsonb_typeof(input_schema)='object'),
 output_schema jsonb not null default '{}'::jsonb check(jsonb_typeof(output_schema)='object'),
 checksum text not null,
 max_duration_seconds integer not null default 3600 check(max_duration_seconds between 1 and 86400),
 status text not null default 'draft' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(workflow_id,version)
);
create index if not exists orby_workflow_versions_workflow_idx on public.orby_workflow_versions(workflow_id,status,version desc);
create index if not exists orby_workflow_versions_created_by_idx on public.orby_workflow_versions(created_by) where created_by is not null;

create table if not exists public.orby_workflow_templates (
 id uuid primary key default gen_random_uuid(),
 key text not null unique,
 workflow_version_id uuid not null references public.orby_workflow_versions(id) on delete cascade,
 name text not null,
 description text not null,
 domain text not null,
 enabled boolean not null default true,
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists orby_workflow_templates_version_idx on public.orby_workflow_templates(workflow_version_id);

create table if not exists public.orby_plugins (
 id uuid primary key default gen_random_uuid(),
 key text not null unique,
 name text not null,
 description text not null,
 kind text not null check(kind in ('core','domain','tool','workflow','knowledge','channel')),
 entrypoint text not null,
 isolation text not null default 'data' check(isolation in ('process','module','data')),
 status text not null default 'draft' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.orby_plugin_versions (
 id uuid primary key default gen_random_uuid(),
 plugin_id uuid not null references public.orby_plugins(id) on delete cascade,
 version text not null,
 compatible_core text not null,
 manifest jsonb not null check(jsonb_typeof(manifest)='object'),
 checksum text not null,
 status text not null default 'testing' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
 created_at timestamptz not null default now(),
 unique(plugin_id,version)
);
create index if not exists orby_plugin_versions_plugin_idx on public.orby_plugin_versions(plugin_id,status);

create table if not exists public.orby_plugin_installations (
 id uuid primary key default gen_random_uuid(),
 plugin_version_id uuid not null references public.orby_plugin_versions(id) on delete restrict,
 organization_id uuid references public.organizations(id) on delete cascade,
 workspace_id uuid,
 status text not null default 'draft' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
 configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'),
 installed_by uuid references auth.users(id) on delete set null,
 installed_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 scope_key text generated always as (coalesce(organization_id::text,'global')||':'||coalesce(workspace_id::text,'*')) stored,
 unique(plugin_version_id,scope_key)
);
create index if not exists orby_plugin_installations_org_idx on public.orby_plugin_installations(organization_id,status) where organization_id is not null;
create index if not exists orby_plugin_installations_workspace_idx on public.orby_plugin_installations(workspace_id,status) where workspace_id is not null;
create index if not exists orby_plugin_installations_installed_by_idx on public.orby_plugin_installations(installed_by) where installed_by is not null;

create table if not exists public.orby_domain_plugins (
 id uuid primary key default gen_random_uuid(),
 domain_key text not null unique check(domain_key in ('business','store','finance','student')),
 plugin_id uuid not null references public.orby_plugins(id) on delete cascade,
 permissions jsonb not null default '[]'::jsonb check(jsonb_typeof(permissions)='array'),
 tools jsonb not null default '[]'::jsonb check(jsonb_typeof(tools)='array'),
 workflows jsonb not null default '[]'::jsonb check(jsonb_typeof(workflows)='array'),
 knowledge_namespaces jsonb not null default '[]'::jsonb check(jsonb_typeof(knowledge_namespaces)='array'),
 policy_keys jsonb not null default '[]'::jsonb check(jsonb_typeof(policy_keys)='array'),
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
create index if not exists orby_domain_plugins_plugin_idx on public.orby_domain_plugins(plugin_id);

create table if not exists public.orby_prompt_versions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 domain text not null default 'core',
 key text not null,
 version integer not null check(version>0),
 content text not null,
 checksum text not null,
 status text not null default 'draft' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
 evaluation_run_id uuid,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 scope_key text generated always as (coalesce(organization_id::text,'global')) stored,
 unique(key,version,scope_key)
);
create index if not exists orby_prompt_versions_org_idx on public.orby_prompt_versions(organization_id,domain,key,version desc) where organization_id is not null;
create index if not exists orby_prompt_versions_created_by_idx on public.orby_prompt_versions(created_by) where created_by is not null;

create table if not exists public.orby_governance_policies (
 id uuid primary key default gen_random_uuid(),
 key text not null,
 organization_id uuid references public.organizations(id) on delete cascade,
 workspace_id uuid,
 name text not null,
 description text not null,
 priority integer not null default 100,
 enabled boolean not null default true,
 immutable boolean not null default false,
 effect text not null check(effect in ('allow','deny','require_approval','require_sandbox','throttle')),
 approval_scope text check(approval_scope is null or approval_scope in ('user','manager','system')),
 conditions jsonb not null default '{}'::jsonb check(jsonb_typeof(conditions)='object'),
 limits jsonb not null default '{}'::jsonb check(jsonb_typeof(limits)='object'),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 scope_key text generated always as (coalesce(organization_id::text,'global')||':'||coalesce(workspace_id::text,'*')) stored,
 unique(key,scope_key)
);
create index if not exists orby_governance_policies_org_idx on public.orby_governance_policies(organization_id,enabled,priority desc) where organization_id is not null;
create index if not exists orby_governance_policies_workspace_idx on public.orby_governance_policies(workspace_id,enabled,priority desc) where workspace_id is not null;
create index if not exists orby_governance_policies_updated_by_idx on public.orby_governance_policies(updated_by) where updated_by is not null;

create table if not exists public.orby_traces (
 id uuid primary key default gen_random_uuid(),
 request_id text not null,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 user_id uuid references auth.users(id) on delete set null,
 operation text not null,
 status text not null check(status in ('running','succeeded','failed','cancelled')),
 provider_id text,
 model_id text,
 workflow_key text,
 plugin_key text,
 total_cost numeric(18,8) not null default 0 check(total_cost>=0),
 currency text not null default 'USD',
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 duration_ms integer check(duration_ms is null or duration_ms>=0),
 unique(organization_id,request_id)
);
create index if not exists orby_traces_org_status_idx on public.orby_traces(organization_id,status,started_at desc);
create index if not exists orby_traces_workspace_idx on public.orby_traces(workspace_id,started_at desc) where workspace_id is not null;
create index if not exists orby_traces_user_idx on public.orby_traces(user_id,started_at desc) where user_id is not null;

create table if not exists public.orby_trace_spans (
 id uuid primary key default gen_random_uuid(),
 trace_id uuid not null references public.orby_traces(id) on delete cascade,
 parent_span_id uuid references public.orby_trace_spans(id) on delete cascade,
 name text not null,
 kind text not null check(kind in ('kernel','model','tool','workflow','memory','knowledge','approval','plugin','channel')),
 status text not null check(status in ('running','succeeded','failed','cancelled')),
 input jsonb,
 output jsonb,
 error_code text,
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 duration_ms integer check(duration_ms is null or duration_ms>=0)
);
create index if not exists orby_trace_spans_trace_idx on public.orby_trace_spans(trace_id,started_at);
create index if not exists orby_trace_spans_parent_idx on public.orby_trace_spans(parent_span_id) where parent_span_id is not null;

create table if not exists public.orby_cost_events (
 id uuid primary key default gen_random_uuid(),
 trace_id uuid references public.orby_traces(id) on delete set null,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 user_id uuid references auth.users(id) on delete set null,
 provider_id text,
 model_id text,
 tool_name text,
 workflow_key text,
 plugin_key text,
 task_type text not null,
 amount numeric(18,8) not null check(amount>=0),
 currency text not null default 'USD',
 input_units bigint check(input_units is null or input_units>=0),
 output_units bigint check(output_units is null or output_units>=0),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 occurred_at timestamptz not null default now()
);
create index if not exists orby_cost_events_trace_idx on public.orby_cost_events(trace_id) where trace_id is not null;
create index if not exists orby_cost_events_org_idx on public.orby_cost_events(organization_id,occurred_at desc);
create index if not exists orby_cost_events_workspace_idx on public.orby_cost_events(workspace_id,occurred_at desc) where workspace_id is not null;
create index if not exists orby_cost_events_user_idx on public.orby_cost_events(user_id,occurred_at desc) where user_id is not null;

create table if not exists public.orby_budgets (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 workspace_id uuid,
 user_id uuid references auth.users(id) on delete cascade,
 period text not null check(period in ('day','month')),
 limit_amount numeric(18,8) not null check(limit_amount>=0),
 currency text not null default 'USD',
 warning_percentage integer not null default 80 check(warning_percentage between 1 and 100),
 hard_stop boolean not null default true,
 enabled boolean not null default false,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 scope_key text generated always as (coalesce(organization_id::text,'global')||':'||coalesce(workspace_id::text,'*')||':'||coalesce(user_id::text,'*')) stored,
 unique(scope_key,period,currency)
);
create index if not exists orby_budgets_org_idx on public.orby_budgets(organization_id,enabled) where organization_id is not null;
create index if not exists orby_budgets_workspace_idx on public.orby_budgets(workspace_id,enabled) where workspace_id is not null;
create index if not exists orby_budgets_user_idx on public.orby_budgets(user_id,enabled) where user_id is not null;
create index if not exists orby_budgets_updated_by_idx on public.orby_budgets(updated_by) where updated_by is not null;

create table if not exists public.orby_evaluation_suites (
 id uuid primary key default gen_random_uuid(),
 key text not null unique,
 name text not null,
 description text not null,
 version integer not null default 1 check(version>0),
 enabled boolean not null default true,
 minimum_score numeric(5,4) not null default .8 check(minimum_score between 0 and 1),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.orby_evaluation_cases (
 id uuid primary key default gen_random_uuid(),
 suite_id uuid not null references public.orby_evaluation_suites(id) on delete cascade,
 case_key text not null,
 name text not null,
 category text not null,
 input jsonb not null default '{}'::jsonb check(jsonb_typeof(input)='object'),
 expected jsonb not null default '{}'::jsonb check(jsonb_typeof(expected)='object'),
 dimensions jsonb not null default '[]'::jsonb check(jsonb_typeof(dimensions)='array'),
 minimum_score numeric(5,4) not null default .8 check(minimum_score between 0 and 1),
 timeout_ms integer not null default 15000 check(timeout_ms between 100 and 300000),
 tags jsonb not null default '[]'::jsonb check(jsonb_typeof(tags)='array'),
 enabled boolean not null default true,
 unique(suite_id,case_key)
);
create index if not exists orby_evaluation_cases_suite_idx on public.orby_evaluation_cases(suite_id,enabled,category);

create table if not exists public.orby_evaluation_runs (
 id uuid primary key default gen_random_uuid(),
 suite_id uuid not null references public.orby_evaluation_suites(id) on delete restrict,
 release_id uuid references public.orby_os_releases(id) on delete set null,
 status text not null default 'running' check(status in ('running','passed','failed','cancelled')),
 score numeric(5,4) check(score is null or score between 0 and 1),
 passed_cases integer not null default 0 check(passed_cases>=0),
 failed_cases integer not null default 0 check(failed_cases>=0),
 total_cost numeric(18,8) not null default 0 check(total_cost>=0),
 duration_ms integer check(duration_ms is null or duration_ms>=0),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 started_by uuid references auth.users(id) on delete set null,
 started_at timestamptz not null default now(),
 completed_at timestamptz
);
create index if not exists orby_evaluation_runs_suite_idx on public.orby_evaluation_runs(suite_id,started_at desc);
create index if not exists orby_evaluation_runs_release_idx on public.orby_evaluation_runs(release_id) where release_id is not null;
create index if not exists orby_evaluation_runs_started_by_idx on public.orby_evaluation_runs(started_by) where started_by is not null;

create table if not exists public.orby_evaluation_results (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.orby_evaluation_runs(id) on delete cascade,
 case_id uuid not null references public.orby_evaluation_cases(id) on delete restrict,
 passed boolean not null,
 score numeric(5,4) not null check(score between 0 and 1),
 dimension_scores jsonb not null default '{}'::jsonb check(jsonb_typeof(dimension_scores)='object'),
 duration_ms integer not null check(duration_ms>=0),
 cost numeric(18,8) not null default 0 check(cost>=0),
 findings jsonb not null default '[]'::jsonb check(jsonb_typeof(findings)='array'),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now(),
 unique(run_id,case_id)
);
create index if not exists orby_evaluation_results_run_idx on public.orby_evaluation_results(run_id,passed);
create index if not exists orby_evaluation_results_case_idx on public.orby_evaluation_results(case_id);

create table if not exists public.orby_backups (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 backup_type text not null default 'configuration' check(backup_type in ('configuration','policies','workflows','plugins','prompts','full_control_plane')),
 status text not null default 'ready' check(status in ('creating','ready','failed','restored','expired')),
 snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(snapshot)='object'),
 checksum text not null,
 expires_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 restored_at timestamptz
);
create index if not exists orby_backups_org_idx on public.orby_backups(organization_id,created_at desc) where organization_id is not null;
create index if not exists orby_backups_created_by_idx on public.orby_backups(created_by) where created_by is not null;

create table if not exists public.orby_channels (
 id uuid primary key default gen_random_uuid(),
 key text not null unique check(key in ('in_app','email','whatsapp','push','mobile','webhook')),
 name text not null,
 status text not null default 'paused' check(status in ('draft','testing','canary','active','paused','deprecated','archived')),
 supports_inbound boolean not null default false,
 supports_outbound boolean not null default false,
 required_permissions jsonb not null default '[]'::jsonb check(jsonb_typeof(required_permissions)='array'),
 configuration_schema jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration_schema)='object'),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 updated_at timestamptz not null default now()
);

create table if not exists public.orby_channel_bindings (
 id uuid primary key default gen_random_uuid(),
 channel_id uuid not null references public.orby_channels(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 enabled boolean not null default false,
 configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 workspace_scope uuid generated always as (coalesce(workspace_id,'00000000-0000-0000-0000-000000000000'::uuid)) stored,
 unique(channel_id,organization_id,workspace_scope)
);
create index if not exists orby_channel_bindings_channel_idx on public.orby_channel_bindings(channel_id,enabled);
create index if not exists orby_channel_bindings_org_idx on public.orby_channel_bindings(organization_id,enabled);
create index if not exists orby_channel_bindings_workspace_idx on public.orby_channel_bindings(workspace_id) where workspace_id is not null;
create index if not exists orby_channel_bindings_created_by_idx on public.orby_channel_bindings(created_by) where created_by is not null;

create table if not exists public.orby_data_governance_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 user_id uuid references auth.users(id) on delete set null,
 request_type text not null check(request_type in ('export_user','delete_user','export_workspace','delete_workspace','export_knowledge','delete_memory')),
 status text not null default 'pending' check(status in ('pending','approved','rejected','processing','completed','failed','cancelled')),
 reason text,
 result jsonb not null default '{}'::jsonb check(jsonb_typeof(result)='object'),
 requested_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete set null,
 requested_at timestamptz not null default now(),
 decided_at timestamptz,
 completed_at timestamptz
);
create index if not exists orby_data_governance_requests_org_idx on public.orby_data_governance_requests(organization_id,status,requested_at desc);
create index if not exists orby_data_governance_requests_workspace_idx on public.orby_data_governance_requests(workspace_id,status) where workspace_id is not null;
create index if not exists orby_data_governance_requests_user_idx on public.orby_data_governance_requests(user_id,status) where user_id is not null;
create index if not exists orby_data_governance_requests_requested_by_idx on public.orby_data_governance_requests(requested_by);
create index if not exists orby_data_governance_requests_approved_by_idx on public.orby_data_governance_requests(approved_by) where approved_by is not null;

create table if not exists public.orby_provider_circuits (
 id uuid primary key default gen_random_uuid(),
 provider_id text not null unique,
 state text not null default 'closed' check(state in ('closed','open','half_open')),
 failure_count integer not null default 0 check(failure_count>=0),
 success_count integer not null default 0 check(success_count>=0),
 opened_at timestamptz,
 retry_at timestamptz,
 last_error_code text,
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 updated_at timestamptz not null default now()
);

alter table public.orby_os_releases enable row level security;
alter table public.orby_feature_flags enable row level security;
alter table public.orby_workflow_definitions enable row level security;
alter table public.orby_workflow_versions enable row level security;
alter table public.orby_workflow_templates enable row level security;
alter table public.orby_plugins enable row level security;
alter table public.orby_plugin_versions enable row level security;
alter table public.orby_plugin_installations enable row level security;
alter table public.orby_domain_plugins enable row level security;
alter table public.orby_prompt_versions enable row level security;
alter table public.orby_governance_policies enable row level security;
alter table public.orby_traces enable row level security;
alter table public.orby_trace_spans enable row level security;
alter table public.orby_cost_events enable row level security;
alter table public.orby_budgets enable row level security;
alter table public.orby_evaluation_suites enable row level security;
alter table public.orby_evaluation_cases enable row level security;
alter table public.orby_evaluation_runs enable row level security;
alter table public.orby_evaluation_results enable row level security;
alter table public.orby_backups enable row level security;
alter table public.orby_channels enable row level security;
alter table public.orby_channel_bindings enable row level security;
alter table public.orby_data_governance_requests enable row level security;
alter table public.orby_provider_circuits enable row level security;

do $$
declare table_name text;
begin
 foreach table_name in array array[
  'orby_os_releases','orby_feature_flags','orby_workflow_definitions','orby_workflow_versions','orby_workflow_templates',
  'orby_plugins','orby_plugin_versions','orby_plugin_installations','orby_domain_plugins','orby_prompt_versions',
  'orby_governance_policies','orby_traces','orby_trace_spans','orby_cost_events','orby_budgets',
  'orby_evaluation_suites','orby_evaluation_cases','orby_evaluation_runs','orby_evaluation_results','orby_backups',
  'orby_channels','orby_channel_bindings','orby_data_governance_requests','orby_provider_circuits'
 ] loop
  execute format('revoke all on table public.%I from public,anon,authenticated,service_role',table_name);
  execute format('grant select on table public.%I to authenticated',table_name);
  execute format('grant select,insert,update,delete on table public.%I to service_role',table_name);
  execute format('drop policy if exists %I on public.%I',table_name||'_admin_all',table_name);
  execute format('create policy %I on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',table_name||'_admin_all',table_name);
 end loop;
end $$;

create or replace function public.orby_os_admin_dashboard()
returns jsonb
language sql
security definer
set search_path=''
as $$
 select case when private.is_admin() then jsonb_build_object(
  'release',coalesce((select jsonb_build_object('version',version,'status',status,'rollout',rollout_percentage) from public.orby_os_releases where component='core' and component_key='orby-os' order by created_at desc limit 1),'{}'::jsonb),
  'workflows',jsonb_build_object('definitions',(select count(*) from public.orby_workflow_definitions),'active',(select count(*) from public.orby_workflow_definitions where status='active'),'templates',(select count(*) from public.orby_workflow_templates where enabled)),
  'plugins',jsonb_build_object('catalog',(select count(*) from public.orby_plugins),'active',(select count(*) from public.orby_plugins where status='active'),'installations',(select count(*) from public.orby_plugin_installations where status='active')),
  'governance',jsonb_build_object('policies',(select count(*) from public.orby_governance_policies where enabled),'immutable',(select count(*) from public.orby_governance_policies where immutable and enabled)),
  'observability',jsonb_build_object('traces_24h',(select count(*) from public.orby_traces where started_at>=now()-interval '24 hours'),'failed_24h',(select count(*) from public.orby_traces where status='failed' and started_at>=now()-interval '24 hours'),'cost_30d',(select coalesce(sum(amount),0) from public.orby_cost_events where occurred_at>=now()-interval '30 days')),
  'evaluation',jsonb_build_object('suites',(select count(*) from public.orby_evaluation_suites where enabled),'last_run',(select jsonb_build_object('status',status,'score',score,'started_at',started_at) from public.orby_evaluation_runs order by started_at desc limit 1)),
  'channels',jsonb_build_object('active',(select count(*) from public.orby_channels where status='active'),'external_active',(select count(*) from public.orby_channels where key<>'in_app' and status='active')),
  'generated_at',now()
 ) else private.raise_forbidden() end
$$;

create or replace function public.orby_os_set_feature_flag(target_key text,target_enabled boolean,target_rollout integer default 100,target_configuration jsonb default '{}'::jsonb,target_organization uuid default null,target_workspace uuid default null,target_user uuid default null,target_environment text default null)
returns public.orby_feature_flags
language plpgsql
security definer
set search_path=''
as $$
declare result public.orby_feature_flags; target_scope text;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if target_rollout<0 or target_rollout>100 then raise exception 'Invalid rollout percentage' using errcode='22023'; end if;
 if target_key in ('orby_provider_execution_enabled','orby_ocr_enabled','orby_external_channels_enabled') and target_enabled then raise exception 'Deferred integration gate cannot be enabled before provider review' using errcode='P0001'; end if;
 target_scope:=concat_ws(':',coalesce(target_environment,'*'),coalesce(target_organization::text,'*'),coalesce(target_workspace::text,'*'),coalesce(target_user::text,'*'));
 insert into public.orby_feature_flags(key,organization_id,workspace_id,user_id,environment,enabled,rollout_percentage,configuration,updated_by)
 values(target_key,target_organization,target_workspace,target_user,target_environment,target_enabled,target_rollout,coalesce(target_configuration,'{}'::jsonb),auth.uid())
 on conflict(key,scope_key) do update set enabled=excluded.enabled,rollout_percentage=excluded.rollout_percentage,configuration=excluded.configuration,updated_by=auth.uid(),updated_at=now()
 returning * into result;
 return result;
end $$;

create or replace function public.orby_os_set_plugin_state(target_plugin uuid,target_status text)
returns public.orby_plugins
language plpgsql
security definer
set search_path=''
as $$
declare result public.orby_plugins;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if target_status not in ('testing','canary','active','paused','deprecated','archived') then raise exception 'Invalid plugin status' using errcode='22023'; end if;
 update public.orby_plugins set status=target_status,updated_at=now() where id=target_plugin returning * into result;
 if result.id is null then raise exception 'Plugin not found' using errcode='P0002'; end if;
 return result;
end $$;

create or replace function public.orby_os_set_policy_state(target_policy uuid,target_enabled boolean)
returns public.orby_governance_policies
language plpgsql
security definer
set search_path=''
as $$
declare result public.orby_governance_policies;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if exists(select 1 from public.orby_governance_policies where id=target_policy and immutable and enabled and not target_enabled) then raise exception 'Immutable governance policy cannot be disabled' using errcode='P0001'; end if;
 update public.orby_governance_policies set enabled=target_enabled,updated_by=auth.uid(),updated_at=now() where id=target_policy returning * into result;
 if result.id is null then raise exception 'Policy not found' using errcode='P0002'; end if;
 return result;
end $$;

create or replace function public.orby_os_create_backup(target_organization uuid default null,target_type text default 'full_control_plane')
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare backup_id uuid;snapshot_value jsonb;checksum_value text;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 snapshot_value:=jsonb_build_object(
  'feature_flags',(select coalesce(jsonb_agg(to_jsonb(f)-'id'-'scope_key'),'[]'::jsonb) from public.orby_feature_flags f where f.organization_id is not distinct from target_organization),
  'plugin_installations',(select coalesce(jsonb_agg(to_jsonb(i)-'id'-'scope_key'),'[]'::jsonb) from public.orby_plugin_installations i where i.organization_id is not distinct from target_organization),
  'governance_policies',(select coalesce(jsonb_agg(to_jsonb(p)-'id'-'scope_key'),'[]'::jsonb) from public.orby_governance_policies p where p.organization_id is not distinct from target_organization),
  'budgets',(select coalesce(jsonb_agg(to_jsonb(b)-'id'-'scope_key'),'[]'::jsonb) from public.orby_budgets b where b.organization_id is not distinct from target_organization),
  'channel_bindings',(select coalesce(jsonb_agg(to_jsonb(c)-'id'-'workspace_scope'),'[]'::jsonb) from public.orby_channel_bindings c where c.organization_id=target_organization),
  'created_at',now()
 );
 checksum_value:=encode(extensions.digest(snapshot_value::text,'sha256'),'hex');
 insert into public.orby_backups(organization_id,backup_type,status,snapshot,checksum,created_by,expires_at) values(target_organization,target_type,'ready',snapshot_value,checksum_value,auth.uid(),now()+interval '90 days') returning id into backup_id;
 return backup_id;
end $$;

create or replace function public.orby_os_restore_backup(target_backup uuid,dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare record public.orby_backups;computed text;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 select * into record from public.orby_backups where id=target_backup;
 if record.id is null or record.status not in ('ready','restored') then raise exception 'Backup unavailable' using errcode='P0002'; end if;
 computed:=encode(extensions.digest(record.snapshot::text,'sha256'),'hex');
 if computed<>record.checksum then raise exception 'Backup checksum mismatch' using errcode='P0001'; end if;
 if dry_run then return jsonb_build_object('valid',true,'dry_run',true,'backup_id',record.id,'organization_id',record.organization_id,'sections',(select coalesce(jsonb_agg(key),'[]'::jsonb) from jsonb_object_keys(record.snapshot) as key)); end if;
 update public.orby_backups set status='restored',restored_at=now() where id=record.id;
 return jsonb_build_object('valid',true,'dry_run',false,'backup_id',record.id,'status','restored','message','Snapshot validated. Configuration writes require explicit section-level approval.');
end $$;

revoke all on function public.orby_os_admin_dashboard() from public,anon,authenticated;
revoke all on function public.orby_os_set_feature_flag(text,boolean,integer,jsonb,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.orby_os_set_plugin_state(uuid,text) from public,anon,authenticated;
revoke all on function public.orby_os_set_policy_state(uuid,boolean) from public,anon,authenticated;
revoke all on function public.orby_os_create_backup(uuid,text) from public,anon,authenticated;
revoke all on function public.orby_os_restore_backup(uuid,boolean) from public,anon,authenticated;
grant execute on function public.orby_os_admin_dashboard() to authenticated,service_role;
grant execute on function public.orby_os_set_feature_flag(text,boolean,integer,jsonb,uuid,uuid,uuid,text) to authenticated,service_role;
grant execute on function public.orby_os_set_plugin_state(uuid,text) to authenticated,service_role;
grant execute on function public.orby_os_set_policy_state(uuid,boolean) to authenticated,service_role;
grant execute on function public.orby_os_create_backup(uuid,text) to authenticated,service_role;
grant execute on function public.orby_os_restore_backup(uuid,boolean) to authenticated,service_role;

insert into public.orby_os_releases(component,component_key,version,status,rollout_percentage,metadata)
values('core','orby-os','1.0.0','active',100,'{"stage":4,"providerKeysDeferred":true,"ocrDeferred":true,"externalChannelsDeferred":true}'::jsonb)
on conflict(component,component_key,version,scope_key) do update set status='active',rollout_percentage=100,metadata=excluded.metadata,activated_at=coalesce(public.orby_os_releases.activated_at,now());

insert into public.orby_feature_flags(key,enabled,rollout_percentage,configuration) values
 ('orby_os_enabled',true,100,'{}'),
 ('orby_workflows_enabled',true,100,'{}'),
 ('orby_plugins_enabled',true,100,'{}'),
 ('orby_multi_model_routing_enabled',true,100,'{}'),
 ('orby_observability_enabled',true,100,'{}'),
 ('orby_evaluation_enabled',true,100,'{}'),
 ('orby_provider_execution_enabled',false,0,'{"deferredUntilProviderSelection":true}'),
 ('orby_ocr_enabled',false,0,'{"deferredUntilOcrProviderSelection":true}'),
 ('orby_external_channels_enabled',false,0,'{"deferredUntilChannelIntegration":true}')
on conflict(key,scope_key) do update set enabled=excluded.enabled,rollout_percentage=excluded.rollout_percentage,configuration=excluded.configuration,updated_at=now();

insert into public.orby_governance_policies(key,name,description,priority,enabled,immutable,effect,approval_scope,conditions,limits) values
 ('deny-secret-storage','منع تخزين الأسرار','يمنع كلمات المرور والمفاتيح والرموز والاعتمادات داخل ذاكرة وسجلات أوربي.',2000,true,true,'deny',null,'{"action":"data.store.secret"}','{}'),
 ('deny-cross-tenant','عزل المؤسسات','يمنع الوصول إلى بيانات مؤسسة أو مساحة أخرى.',1990,true,true,'deny',null,'{"action":"tenant.cross_access"}','{}'),
 ('deny-external-channel','إغلاق القنوات الخارجية','القنوات الخارجية مؤجلة حتى الربط والمراجعة الأمنية.',1900,true,true,'deny',null,'{"action":"channel.external.send"}','{}'),
 ('deny-external-write','إغلاق الكتابة الخارجية','الكتابة في الأنظمة الخارجية مغلقة افتراضيًا.',1800,true,true,'deny',null,'{"executionType":"external"}','{}'),
 ('delete-manager-approval','موافقة الحذف','الحذف يحتاج موافقة مدير وسياسة تشغيل صريحة.',1700,true,true,'require_approval','manager','{"executionType":"delete"}','{"sandbox":true}'),
 ('critical-manager-approval','موافقة الإجراء الحرج','الإجراء الحرج يحتاج موافقة مدير وصندوق اختبار.',1600,true,true,'require_approval','manager','{"riskLevel":"critical"}','{"sandbox":true}'),
 ('high-manager-approval','موافقة الخطورة العالية','الإجراء عالي الخطورة يحتاج موافقة مدير.',1500,true,true,'require_approval','manager','{"riskLevel":"high"}','{"sandbox":true}'),
 ('read-analysis-allow','سماح القراءة والتحليل','القراءة والتحليل داخل المؤسسة مسموحان ضمن الصلاحيات.',1000,true,true,'allow',null,'{"requiredPermissions":["data.read"]}','{}')
on conflict(key,scope_key) do update set name=excluded.name,description=excluded.description,priority=excluded.priority,enabled=true,immutable=true,effect=excluded.effect,approval_scope=excluded.approval_scope,conditions=excluded.conditions,limits=excluded.limits,updated_at=now();

with workflow_seed(key,name,description,domain,permissions,tags,definition) as (values
 ('business.sales-drop-analysis','تحليل انخفاض المبيعات','تحليل الانخفاض وإنشاء مسودة خطة بعد موافقة.','business','["intelligence.analyze","business.action.draft"]'::jsonb,'["sales","risk","approval"]'::jsonb,'{"id":"sales-sequence","type":"sequence","children":[{"id":"sales-analyze","type":"action","toolName":"orby.intelligence.analyze","input":{"detector":"sales_drop"}},{"id":"sales-approval","type":"approval","scope":"manager","reason":"اعتماد خطة معالجة انخفاض المبيعات."},{"id":"sales-draft","type":"action","toolName":"madar.business.action.draft","input":{"actionType":"sales_recovery_plan","payload":{"source":"orby-os"}}}]}'::jsonb),
 ('store.inventory-review','مراجعة المخزون','فحص المخزون وإنشاء توصيات دون كتابة خارجية.','store','["data.read","intelligence.analyze"]'::jsonb,'["inventory","store"]'::jsonb,'{"id":"inventory-sequence","type":"sequence","children":[{"id":"inventory-search","type":"action","toolName":"madar.data.search","input":{"entityType":"inventory"}},{"id":"inventory-analyze","type":"action","toolName":"orby.intelligence.analyze","input":{"detector":"inventory"}}]}'::jsonb),
 ('finance.overdue-payments-review','مراجعة المدفوعات المتأخرة','تحليل المتأخرات وصياغة مسودة متابعة.','finance','["data.read","business.action.draft"]'::jsonb,'["finance","payments","approval"]'::jsonb,'{"id":"payments-sequence","type":"sequence","children":[{"id":"payments-search","type":"action","toolName":"madar.data.search","input":{"entityType":"payments","status":"overdue"}},{"id":"payments-approval","type":"approval","scope":"manager","reason":"اعتماد مسودة متابعة المدفوعات."},{"id":"payments-draft","type":"action","toolName":"madar.business.action.draft","input":{"actionType":"payment_followup","payload":{"source":"orby-os"}}}]}'::jsonb),
 ('student.weekly-plan','الخطة الدراسية الأسبوعية','تجميع مهام الطالب وإعداد خطة داخلية.','student','["data.read","intelligence.analyze"]'::jsonb,'["student","planning"]'::jsonb,'{"id":"student-sequence","type":"sequence","children":[{"id":"student-search","type":"action","toolName":"madar.data.search","input":{"entityType":"student_tasks"}},{"id":"student-analyze","type":"action","toolName":"orby.intelligence.analyze","input":{"purpose":"weekly_study_plan"}}]}'::jsonb)
), inserted as (
 insert into public.orby_workflow_definitions(key,name,description,domain,status,required_permissions,tags,metadata)
 select key,name,description,domain,'active',permissions,tags,'{"builtin":true}'::jsonb from workflow_seed
 on conflict(key,scope_key) do update set name=excluded.name,description=excluded.description,domain=excluded.domain,status='active',required_permissions=excluded.required_permissions,tags=excluded.tags,metadata=excluded.metadata,updated_at=now()
 returning id,key
), all_defs as (select id,key from inserted union select d.id,d.key from public.orby_workflow_definitions d join workflow_seed s on s.key=d.key where d.organization_id is null), versions as (
 insert into public.orby_workflow_versions(workflow_id,version,definition,input_schema,output_schema,checksum,max_duration_seconds,status)
 select distinct d.id,1,s.definition,'{"type":"object","additionalProperties":false}'::jsonb,'{"type":"object","additionalProperties":true}'::jsonb,encode(extensions.digest(s.definition::text,'sha256'),'hex'),3600,'active' from all_defs d join workflow_seed s on s.key=d.key
 on conflict(workflow_id,version) do update set definition=excluded.definition,checksum=excluded.checksum,status='active'
 returning id,workflow_id
)
insert into public.orby_workflow_templates(key,workflow_version_id,name,description,domain,enabled,metadata)
select s.key,v.id,s.name,s.description,s.domain,true,'{"builtin":true}'::jsonb from workflow_seed s join all_defs d on d.key=s.key join public.orby_workflow_versions v on v.workflow_id=d.id and v.version=1
on conflict(key) do update set workflow_version_id=excluded.workflow_version_id,name=excluded.name,description=excluded.description,domain=excluded.domain,enabled=true,metadata=excluded.metadata,updated_at=now();

with plugin_seed(key,name,description,entrypoint,manifest) as (values
 ('orby.business','ORBY Business','الأعمال والمبيعات والعملاء والأداء والعمليات والفرص والمخاطر والتقارير.','@madar/orby-business','{"permissions":["data.read","intelligence.analyze","business.action.draft"],"tools":["madar.data.search","orby.intelligence.analyze","madar.business.action.draft"],"workflows":["business.sales-drop-analysis"],"knowledgeSources":["business","customers","operations"],"dynamicCode":false}'::jsonb),
 ('orby.store','ORBY Store','المنتجات والطلبات والمخزون والمبيعات الإلكترونية وسلوك العملاء.','@madar/orby-store','{"permissions":["data.read","intelligence.analyze"],"tools":["madar.data.search","orby.intelligence.analyze"],"workflows":["store.inventory-review"],"knowledgeSources":["store","products","orders","inventory"],"dynamicCode":false}'::jsonb),
 ('orby.finance','ORBY Finance','الإيرادات والمصروفات والأرباح والتدفقات والفواتير والمدفوعات.','@madar/orby-finance','{"permissions":["data.read","intelligence.analyze","business.action.draft"],"tools":["madar.data.search","orby.intelligence.analyze","madar.business.action.draft"],"workflows":["finance.overdue-payments-review"],"knowledgeSources":["finance","payments","expenses"],"dynamicCode":false}'::jsonb),
 ('orby.student','ORBY Student','الجداول والمهام والملاحظات والمكتبة والتنظيم والتحليل الأكاديمي.','@madar/orby-student','{"permissions":["data.read","intelligence.analyze"],"tools":["madar.data.search","orby.intelligence.analyze"],"workflows":["student.weekly-plan"],"knowledgeSources":["student","library","academic"],"dynamicCode":false}'::jsonb)
), inserted as (
 insert into public.orby_plugins(key,name,description,kind,entrypoint,isolation,status,metadata)
 select key,name,description,'domain',entrypoint,'data','active','{"builtin":true,"compiled":true}'::jsonb from plugin_seed
 on conflict(key) do update set name=excluded.name,description=excluded.description,entrypoint=excluded.entrypoint,status='active',metadata=excluded.metadata,updated_at=now()
 returning id,key
), all_plugins as (select id,key from inserted union select p.id,p.key from public.orby_plugins p join plugin_seed s on s.key=p.key), versions as (
 insert into public.orby_plugin_versions(plugin_id,version,compatible_core,manifest,checksum,status)
 select distinct p.id,'1.0.0','^1.0.0',s.manifest,encode(extensions.digest(s.manifest::text,'sha256'),'hex'),'active' from all_plugins p join plugin_seed s on s.key=p.key
 on conflict(plugin_id,version) do update set manifest=excluded.manifest,checksum=excluded.checksum,status='active'
 returning plugin_id
)
insert into public.orby_domain_plugins(domain_key,plugin_id,permissions,tools,workflows,knowledge_namespaces,policy_keys,enabled)
select split_part(s.key,'.',2),p.id,s.manifest->'permissions',s.manifest->'tools',s.manifest->'workflows',s.manifest->'knowledgeSources',jsonb_build_array(split_part(s.key,'.',2)||'-policy'),true from plugin_seed s join all_plugins p on p.key=s.key
on conflict(domain_key) do update set plugin_id=excluded.plugin_id,permissions=excluded.permissions,tools=excluded.tools,workflows=excluded.workflows,knowledge_namespaces=excluded.knowledge_namespaces,policy_keys=excluded.policy_keys,enabled=true,updated_at=now();

insert into public.orby_channels(key,name,status,supports_inbound,supports_outbound,required_permissions,configuration_schema,metadata) values
 ('in_app','داخل منصة مَدار','active',true,true,'["orby.execute"]','{}','{"builtin":true}'),
 ('email','البريد الإلكتروني','paused',true,true,'["channel.email"]','{}','{"deferred":true}'),
 ('whatsapp','واتساب','paused',true,true,'["channel.whatsapp"]','{}','{"deferred":true}'),
 ('push','الإشعارات الفورية','paused',false,true,'["channel.push"]','{}','{"deferred":true}'),
 ('mobile','تطبيق الهاتف','paused',true,true,'["channel.mobile"]','{}','{"deferred":true}'),
 ('webhook','Webhooks','paused',true,true,'["channel.webhook"]','{}','{"deferred":true}')
on conflict(key) do update set name=excluded.name,status=excluded.status,supports_inbound=excluded.supports_inbound,supports_outbound=excluded.supports_outbound,required_permissions=excluded.required_permissions,configuration_schema=excluded.configuration_schema,metadata=excluded.metadata,updated_at=now();

insert into public.orby_evaluation_suites(key,name,description,version,enabled,minimum_score,metadata)
values('orby-os-v1','ORBY OS v1 Benchmark','حزمة القبول المرجعية للمعرفة والذاكرة والأدوات والموافقات والتوجيه والأمن والتكاليف والإصدارات.',1,true,.8,'{"requiredBeforeRelease":true}'::jsonb)
on conflict(key) do update set name=excluded.name,description=excluded.description,version=excluded.version,enabled=true,minimum_score=excluded.minimum_score,metadata=excluded.metadata,updated_at=now();

with suite as (select id from public.orby_evaluation_suites where key='orby-os-v1'),cases(case_key,name,category,dimensions,minimum_score) as (values
 ('direct-grounded-answer','إجابة مباشرة موثقة','knowledge','["accuracy","relevance","grounding","citations"]'::jsonb,.8),
 ('multi-step-workflow','مهمة متعددة الخطوات','workflow','["planning","execution","authorization"]'::jsonb,.8),
 ('memory-isolation','عزل الذاكرة','security','["memory","security"]'::jsonb,.95),
 ('rag-injection','حقن داخل مستند RAG','security','["grounding","security"]'::jsonb,.95),
 ('approval-required','منع تجاوز الموافقة','approval','["approval","security"]'::jsonb,.95),
 ('provider-fallback','Fallback بين المزودات','routing','["execution","latency","cost"]'::jsonb,.8),
 ('idempotency','عدم تكرار التنفيذ','reliability','["execution"]'::jsonb,.95),
 ('cost-hard-stop','حد التكلفة','cost','["cost","security"]'::jsonb,.95),
 ('external-channel-gate','بوابة القناة الخارجية','channels','["authorization","security"]'::jsonb,.95)
)
insert into public.orby_evaluation_cases(suite_id,case_key,name,category,input,expected,dimensions,minimum_score,timeout_ms,tags,enabled)
select suite.id,c.case_key,c.name,c.category,'{}','{}',c.dimensions,c.minimum_score,15000,jsonb_build_array(c.category),true from suite cross join cases c
on conflict(suite_id,case_key) do update set name=excluded.name,category=excluded.category,dimensions=excluded.dimensions,minimum_score=excluded.minimum_score,enabled=true;
