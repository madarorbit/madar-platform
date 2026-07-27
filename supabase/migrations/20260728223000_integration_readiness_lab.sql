begin;

alter table public.integration_feature_flags drop constraint if exists integration_feature_key_check;
alter table public.integration_feature_flags add constraint integration_feature_key_check check (key in (
 'integration_engine_enabled','integration_worker_enabled','integration_scheduler_enabled','integration_write_enabled',
 'integration_pipeline_enabled','integration_quality_center_enabled','integration_readiness_lab_enabled'
));
insert into public.integration_feature_flags(organization_id,key,enabled)
values(null,'integration_readiness_lab_enabled',false)
on conflict do nothing;

insert into public.integration_connectors(connector_key,version,display_name,description,auth_schemes,capabilities,internal_only,enabled)
values
 ('madar-reference-commerce','1.0.0','MADAR Reference Commerce','Deterministic synthetic commerce system for historical, incremental, failure, duplicate and recovery acceptance tests.',array['api_key'],jsonb_build_object('read',true,'write',false,'polling',true,'webhooks',false,'files',false,'database',false,'localBridge',false),true,false),
 ('madar-test-rest','1.0.0','MADAR REST Test Connector','Internal REST pagination and authentication simulator.',array['api_key','bearer','oauth2'],jsonb_build_object('read',true,'write',false,'polling',true,'webhooks',false,'files',false,'database',false,'localBridge',false),true,false),
 ('madar-test-webhook','1.0.0','MADAR Webhook Test Connector','Internal signed webhook inbox and replay simulator.',array['custom'],jsonb_build_object('read',true,'write',false,'polling',false,'webhooks',true,'files',false,'database',false,'localBridge',false),true,false),
 ('madar-test-csv-excel','1.0.0','MADAR CSV & Excel Test Connector','Internal CSV and Excel SpreadsheetML reader that never executes formulas.',array['none'],jsonb_build_object('read',true,'write',false,'polling',false,'webhooks',false,'files',true,'database',false,'localBridge',false),true,false),
 ('madar-test-database-readonly','1.0.0','MADAR Read-only Database Test Connector','Internal database connector that accepts SELECT or WITH only.',array['database'],jsonb_build_object('read',true,'write',false,'polling',true,'webhooks',false,'files',false,'database',true,'localBridge',false),true,false),
 ('madar-test-local-bridge','1.0.0','MADAR Local Bridge Simulator','Internal ordered envelope and offline recovery simulator.',array['custom'],jsonb_build_object('read',true,'write',false,'polling',true,'webhooks',false,'files',true,'database',true,'localBridge',true),true,false),
 ('madar-test-oauth','1.0.0','MADAR OAuth Expiry Simulator','Internal OAuth2 expiry and refresh-token simulator.',array['oauth2'],jsonb_build_object('read',true,'write',false,'polling',true,'webhooks',false,'files',false,'database',false,'localBridge',false),true,false)
on conflict(connector_key) do update set version=excluded.version,display_name=excluded.display_name,description=excluded.description,auth_schemes=excluded.auth_schemes,capabilities=excluded.capabilities,internal_only=excluded.internal_only,updated_at=now();

create table if not exists public.integration_readiness_runs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete set null,
 started_by uuid references auth.users(id) on delete set null,
 status text not null default 'running',
 suite_version text not null,
 connector_version text not null,
 total_checks integer not null default 0,
 passed_checks integer not null default 0,
 failed_checks integer not null default 0,
 summary jsonb not null default '{}',
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 created_at timestamptz not null default now(),
 constraint integration_readiness_runs_status_check check(status in ('running','passed','failed','cancelled')),
 constraint integration_readiness_runs_counts_check check(total_checks>=0 and passed_checks>=0 and failed_checks>=0 and passed_checks+failed_checks<=total_checks)
);
create index if not exists integration_readiness_runs_started_idx on public.integration_readiness_runs(started_at desc);
create index if not exists integration_readiness_runs_organization_idx on public.integration_readiness_runs(organization_id,started_at desc);
create index if not exists integration_readiness_runs_actor_idx on public.integration_readiness_runs(started_by,started_at desc);

create table if not exists public.integration_readiness_checks (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.integration_readiness_runs(id) on delete cascade,
 check_key text not null,
 title text not null,
 status text not null,
 duration_ms integer not null default 0,
 details jsonb not null default '{}',
 error_code text,
 error_message text,
 created_at timestamptz not null default now(),
 constraint integration_readiness_checks_status_check check(status in ('passed','failed')),
 constraint integration_readiness_checks_duration_check check(duration_ms>=0),
 unique(run_id,check_key)
);
create index if not exists integration_readiness_checks_run_idx on public.integration_readiness_checks(run_id,created_at);
create index if not exists integration_readiness_checks_status_idx on public.integration_readiness_checks(status,created_at desc);

alter table public.integration_readiness_runs enable row level security;
alter table public.integration_readiness_checks enable row level security;

revoke all on public.integration_readiness_runs,public.integration_readiness_checks from anon,authenticated;
grant select,insert,update,delete on public.integration_readiness_runs,public.integration_readiness_checks to service_role;

comment on table public.integration_readiness_runs is 'Execution ledger for the MADAR connector readiness acceptance suite.';
comment on table public.integration_readiness_checks is 'Immutable per-criterion results produced by the readiness lab.';

commit;
