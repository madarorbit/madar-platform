-- ORBY Initial Architecture & Build Roadmap — Stage 2
-- Agent Execution Layer. Additive over the existing ORBY foundation and MADAR Integration Engine.
-- No provider credentials, connector secrets or dynamic executable code are stored here.

create extension if not exists pgcrypto;

create table if not exists public.orby_execution_config (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 enabled boolean not null default false,
 config jsonb not null default '{}'::jsonb,
 revision integer not null default 1 check (revision > 0),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(config)='object')
);
create unique index if not exists orby_execution_config_scope_uidx on public.orby_execution_config(coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists orby_execution_config_org_idx on public.orby_execution_config(organization_id);
create index if not exists orby_execution_config_created_by_idx on public.orby_execution_config(created_by);
create index if not exists orby_execution_config_updated_by_idx on public.orby_execution_config(updated_by);

create table if not exists public.orby_tool_catalog (
 name text primary key,
 version text not null,
 category text not null check (category in ('data','files','platform','business','intelligence','integration')),
 status text not null default 'active' check (status in ('active','disabled','deprecated','internal')),
 enabled boolean not null default false,
 manifest jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(manifest)='object')
);
create index if not exists orby_tool_catalog_enabled_idx on public.orby_tool_catalog(enabled,status,category,name);

create table if not exists public.orby_workflows (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 goal text not null check (char_length(goal) between 5 and 12000),
 plan jsonb not null,
 status text not null default 'active' check (status in ('draft','active','archived')),
 version integer not null default 1 check (version > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(plan)='object')
);
create index if not exists orby_workflows_org_created_idx on public.orby_workflows(organization_id,created_at desc);
create index if not exists orby_workflows_created_by_idx on public.orby_workflows(created_by);

create table if not exists public.orby_workflow_runs (
 id uuid primary key default gen_random_uuid(),
 workflow_id uuid not null references public.orby_workflows(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid,
 status text not null default 'pending' check (status in ('pending','running','waiting','retry','failed','completed','cancelled')),
 reason text not null check (char_length(reason) between 1 and 12000),
 state jsonb not null default '{"completedNodeIds":[],"variables":{},"results":{}}'::jsonb,
 result jsonb,
 error_code text,
 error_message text,
 created_at timestamptz not null default now(),
 started_at timestamptz,
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(state)='object')
);
create index if not exists orby_workflow_runs_workflow_idx on public.orby_workflow_runs(workflow_id,created_at desc);
create index if not exists orby_workflow_runs_org_status_idx on public.orby_workflow_runs(organization_id,status,updated_at desc);
create index if not exists orby_workflow_runs_user_idx on public.orby_workflow_runs(user_id,created_at desc);

create table if not exists public.orby_actions (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.orby_workflow_runs(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 step_key text not null,
 tool_name text not null,
 operation text not null,
 status text not null default 'pending' check (status in ('pending','running','waiting_approval','retry','failed','completed','cancelled','compensated')),
 input jsonb not null default '{}'::jsonb,
 result jsonb,
 error_code text,
 error_message text,
 attempt integer not null default 0 check (attempt >= 0),
 max_attempts integer not null default 3 check (max_attempts between 1 and 20),
 risk_level text not null check (risk_level in ('low','medium','high','critical')),
 execution_mode text not null default 'production' check (execution_mode in ('production','sandbox')),
 compensation jsonb,
 started_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(run_id,step_key),
 check (jsonb_typeof(input)='object'),
 check (compensation is null or jsonb_typeof(compensation)='object')
);
create index if not exists orby_actions_run_status_idx on public.orby_actions(run_id,status,created_at);
create index if not exists orby_actions_org_idx on public.orby_actions(organization_id,created_at desc);
create index if not exists orby_actions_user_idx on public.orby_actions(user_id,created_at desc);
create index if not exists orby_actions_tool_idx on public.orby_actions(tool_name,created_at desc);

create table if not exists public.orby_approvals (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.orby_workflow_runs(id) on delete cascade,
 action_id uuid references public.orby_actions(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 requested_by uuid not null references auth.users(id) on delete cascade,
 scope text not null check (scope in ('user','manager','system')),
 status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
 reason text not null,
 decided_by uuid references auth.users(id) on delete set null,
 decision_reason text,
 expires_at timestamptz not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 check (jsonb_typeof(metadata)='object')
);
create unique index if not exists orby_approvals_pending_action_uidx on public.orby_approvals(action_id) where action_id is not null and status='pending';
create index if not exists orby_approvals_run_idx on public.orby_approvals(run_id,created_at desc);
create index if not exists orby_approvals_org_status_idx on public.orby_approvals(organization_id,status,expires_at);
create index if not exists orby_approvals_requested_by_idx on public.orby_approvals(requested_by,created_at desc);
create index if not exists orby_approvals_decided_by_idx on public.orby_approvals(decided_by);

create table if not exists public.orby_execution_queue (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.orby_workflow_runs(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','running','waiting','retry','failed','completed','cancelled')),
 priority integer not null default 100,
 available_at timestamptz not null default now(),
 attempts integer not null default 0 check (attempts >= 0),
 max_attempts integer not null default 5 check (max_attempts between 1 and 20),
 idempotency_key text,
 locked_at timestamptz,
 locked_by text,
 lease_expires_at timestamptz,
 result jsonb not null default '{}'::jsonb,
 last_error_code text,
 last_error_message text,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(result)='object')
);
create unique index if not exists orby_execution_queue_idempotency_uidx on public.orby_execution_queue(organization_id,idempotency_key) where idempotency_key is not null;
create index if not exists orby_execution_queue_claim_idx on public.orby_execution_queue(status,available_at,priority,created_at) where status in ('pending','retry','waiting');
create index if not exists orby_execution_queue_run_idx on public.orby_execution_queue(run_id,created_at desc);
create index if not exists orby_execution_queue_org_idx on public.orby_execution_queue(organization_id,created_at desc);

create table if not exists public.orby_execution_events (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.orby_workflow_runs(id) on delete cascade,
 action_id uuid references public.orby_actions(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 event_type text not null,
 payload jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now(),
 check (jsonb_typeof(payload)='object')
);
create index if not exists orby_execution_events_run_idx on public.orby_execution_events(run_id,occurred_at,id);
create index if not exists orby_execution_events_action_idx on public.orby_execution_events(action_id,occurred_at);
create index if not exists orby_execution_events_org_idx on public.orby_execution_events(organization_id,occurred_at desc);

create table if not exists public.orby_execution_audit (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.orby_workflow_runs(id) on delete cascade,
 action_id uuid references public.orby_actions(id) on delete set null,
 approval_id uuid references public.orby_approvals(id) on delete set null,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 event_type text not null,
 reason text,
 outcome text,
 metadata jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now(),
 check (jsonb_typeof(metadata)='object')
);
create index if not exists orby_execution_audit_run_idx on public.orby_execution_audit(run_id,occurred_at,id);
create index if not exists orby_execution_audit_action_idx on public.orby_execution_audit(action_id,occurred_at);
create index if not exists orby_execution_audit_approval_idx on public.orby_execution_audit(approval_id,occurred_at);
create index if not exists orby_execution_audit_org_idx on public.orby_execution_audit(organization_id,occurred_at desc);
create index if not exists orby_execution_audit_actor_idx on public.orby_execution_audit(actor_id,occurred_at desc);

create table if not exists public.orby_sandbox_runs (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.orby_workflow_runs(id) on delete cascade,
 action_id uuid not null unique references public.orby_actions(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 tool_name text not null,
 status text not null check (status in ('running','completed','failed')),
 input jsonb not null default '{}'::jsonb,
 result jsonb,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 check (jsonb_typeof(input)='object')
);
create index if not exists orby_sandbox_runs_run_idx on public.orby_sandbox_runs(run_id,created_at desc);
create index if not exists orby_sandbox_runs_org_idx on public.orby_sandbox_runs(organization_id,created_at desc);
create index if not exists orby_sandbox_runs_user_idx on public.orby_sandbox_runs(user_id,created_at desc);

create table if not exists public.orby_execution_usage (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 bucket_type text not null check (bucket_type in ('minute','day')),
 bucket_start timestamptz not null,
 used integer not null default 0 check (used >= 0),
 updated_at timestamptz not null default now(),
 unique(organization_id,user_id,bucket_type,bucket_start)
);
create index if not exists orby_execution_usage_org_user_idx on public.orby_execution_usage(organization_id,user_id,bucket_start desc);

alter table public.orby_execution_config enable row level security;
alter table public.orby_tool_catalog enable row level security;
alter table public.orby_workflows enable row level security;
alter table public.orby_workflow_runs enable row level security;
alter table public.orby_actions enable row level security;
alter table public.orby_approvals enable row level security;
alter table public.orby_execution_queue enable row level security;
alter table public.orby_execution_events enable row level security;
alter table public.orby_execution_audit enable row level security;
alter table public.orby_sandbox_runs enable row level security;
alter table public.orby_execution_usage enable row level security;
