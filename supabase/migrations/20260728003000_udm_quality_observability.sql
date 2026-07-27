begin;

alter table public.integration_jobs drop constraint if exists integration_jobs_type_check;
alter table public.integration_jobs add constraint integration_jobs_type_check check (job_type in ('connection.test','sync.initial','sync.incremental','pipeline.process_batch'));

alter table public.integration_feature_flags drop constraint if exists integration_feature_key_check;
alter table public.integration_feature_flags add constraint integration_feature_key_check check (key in (
 'integration_engine_enabled','integration_worker_enabled','integration_scheduler_enabled','integration_write_enabled',
 'integration_pipeline_enabled','integration_quality_center_enabled'
));
insert into public.integration_feature_flags(organization_id,key,enabled)
values (null,'integration_pipeline_enabled',false),(null,'integration_quality_center_enabled',false)
on conflict do nothing;

create table if not exists public.integration_mapping_rules (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 connection_id uuid references public.integration_connections(id) on delete cascade,
 connector_key text references public.integration_connectors(connector_key),
 stream_key text not null,
 entity_type text not null,
 field_map jsonb not null default '{}',
 defaults jsonb not null default '{}',
 relation_map jsonb not null default '{}',
 source_timezone text not null default 'UTC',
 default_currency text,
 default_unit text,
 priority smallint not null default 100,
 version integer not null default 1,
 is_active boolean not null default true,
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_mapping_entity_check check (entity_type in ('organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event')),
 constraint integration_mapping_version_check check (version>0),
 constraint integration_mapping_currency_check check (default_currency is null or default_currency ~ '^[A-Z]{3}$')
);
create unique index if not exists integration_mapping_connection_version_idx on public.integration_mapping_rules(connection_id,stream_key,entity_type,version) where connection_id is not null;
create unique index if not exists integration_mapping_connector_version_idx on public.integration_mapping_rules(connector_key,stream_key,entity_type,version) where connection_id is null and connector_key is not null and organization_id is null;
create index if not exists integration_mapping_lookup_idx on public.integration_mapping_rules(connection_id,connector_key,stream_key,is_active,priority);

create table if not exists public.integration_validation_rules (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 entity_type text,
 rule_key text not null,
 severity text not null default 'error',
 field_path text,
 rule_type text not null,
 config jsonb not null default '{}',
 version integer not null default 1,
 is_active boolean not null default true,
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_validation_entity_check check (entity_type is null or entity_type in ('organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event')),
 constraint integration_validation_severity_check check (severity in ('info','warning','error','critical')),
 constraint integration_validation_type_check check (rule_type in ('required','type','enum','range','pattern','relation','custom')),
 constraint integration_validation_version_check check (version>0)
);
create unique index if not exists integration_validation_global_idx on public.integration_validation_rules(rule_key,version) where organization_id is null;
create unique index if not exists integration_validation_workspace_idx on public.integration_validation_rules(organization_id,rule_key,version) where organization_id is not null;
create index if not exists integration_validation_lookup_idx on public.integration_validation_rules(organization_id,entity_type,is_active);

create table if not exists public.integration_pipeline_runs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.integration_connections(id) on delete cascade,
 raw_batch_id uuid not null unique references public.integration_raw_batches(id) on delete cascade,
 status text not null default 'running',
 current_stage text not null default 'raw',
 total_records integer not null default 0,
 valid_records integer not null default 0,
 invalid_records integer not null default 0,
 unified_records integer not null default 0,
 duplicate_records integer not null default 0,
 warning_count integer not null default 0,
 error_count integer not null default 0,
 metrics jsonb not null default '{}',
 last_error_code text,
 last_error_message text,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_pipeline_status_check check (status in ('running','succeeded','partial','failed','cancelled')),
 constraint integration_pipeline_stage_check check (current_stage in ('source','raw','validate','transform','map','deduplicate','unified','complete')),
 constraint integration_pipeline_counts_check check (total_records>=0 and valid_records>=0 and invalid_records>=0 and unified_records>=0 and duplicate_records>=0 and warning_count>=0 and error_count>=0)
);
create index if not exists integration_pipeline_runs_connection_idx on public.integration_pipeline_runs(connection_id,started_at desc);
create index if not exists integration_pipeline_runs_org_status_idx on public.integration_pipeline_runs(organization_id,status,started_at desc);

create table if not exists public.integration_udm_records (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 entity_type text not null,
 identity_hash text not null,
 natural_key text,
 external_id text,
 canonical_data jsonb not null default '{}',
 lifecycle_status text not null default 'active',
 source_count integer not null default 1,
 quality_score numeric(5,2) not null default 100,
 currency_code text,
 timezone text not null default 'UTC',
 unit_code text,
 quantity numeric,
 source_created_at timestamptz,
 source_updated_at timestamptz,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 duplicate_of uuid references public.integration_udm_records(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_udm_entity_check check (entity_type in ('organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event')),
 constraint integration_udm_lifecycle_check check (lifecycle_status in ('active','inactive','archived','cancelled','unknown')),
 constraint integration_udm_identity_check check (identity_hash ~ '^[a-f0-9]{64}$'),
 constraint integration_udm_quality_check check (quality_score between 0 and 100),
 constraint integration_udm_currency_check check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
 constraint integration_udm_source_count_check check (source_count>0)
);
create unique index if not exists integration_udm_identity_idx on public.integration_udm_records(organization_id,entity_type,identity_hash);
create index if not exists integration_udm_entity_updated_idx on public.integration_udm_records(organization_id,entity_type,updated_at desc);
create index if not exists integration_udm_external_idx on public.integration_udm_records(organization_id,entity_type,external_id) where external_id is not null;
create index if not exists integration_udm_duplicate_idx on public.integration_udm_records(duplicate_of) where duplicate_of is not null;

create table if not exists public.integration_pipeline_records (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.integration_connections(id) on delete cascade,
 raw_batch_id uuid not null references public.integration_raw_batches(id) on delete cascade,
 pipeline_run_id uuid not null references public.integration_pipeline_runs(id) on delete cascade,
 record_index integer not null,
 source_key text,
 entity_type text,
 status text not null default 'processing',
 current_stage text not null default 'raw',
 source_payload jsonb not null,
 transformed_payload jsonb not null default '{}',
 canonical_payload jsonb not null default '{}',
 identity_hash text,
 unified_record_id uuid references public.integration_udm_records(id) on delete set null,
 validation_errors jsonb not null default '[]',
 warnings jsonb not null default '[]',
 match_score numeric(5,4),
 duplicate_of uuid references public.integration_udm_records(id) on delete set null,
 processed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_pipeline_record_index_check check (record_index>=0),
 constraint integration_pipeline_record_status_check check (status in ('processing','accepted','rejected','duplicate','quarantined')),
 constraint integration_pipeline_record_stage_check check (current_stage in ('raw','validate','transform','map','deduplicate','unified','complete')),
 constraint integration_pipeline_record_entity_check check (entity_type is null or entity_type in ('organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event')),
 constraint integration_pipeline_match_check check (match_score is null or match_score between 0 and 1),
 unique(raw_batch_id,record_index)
);
create index if not exists integration_pipeline_records_run_idx on public.integration_pipeline_records(pipeline_run_id,record_index);
create index if not exists integration_pipeline_records_status_idx on public.integration_pipeline_records(organization_id,status,created_at desc);
create index if not exists integration_pipeline_records_unified_idx on public.integration_pipeline_records(unified_record_id) where unified_record_id is not null;

create table if not exists public.integration_udm_source_keys (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.integration_connections(id) on delete cascade,
 entity_type text not null,
 source_key text not null,
 unified_record_id uuid not null references public.integration_udm_records(id) on delete cascade,
 raw_batch_id uuid references public.integration_raw_batches(id) on delete set null,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 constraint integration_source_key_entity_check check (entity_type in ('organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event')),
 unique(organization_id,connection_id,entity_type,source_key)
);
create index if not exists integration_source_keys_unified_idx on public.integration_udm_source_keys(unified_record_id);

create table if not exists public.integration_udm_relations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 from_record_id uuid not null references public.integration_udm_records(id) on delete cascade,
 relation_key text not null,
 to_entity_type text not null,
 target_source_key text not null,
 to_record_id uuid references public.integration_udm_records(id) on delete set null,
 status text not null default 'unresolved',
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_relation_entity_check check (to_entity_type in ('organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event')),
 constraint integration_relation_status_check check (status in ('resolved','unresolved','ignored')),
 unique(from_record_id,relation_key,to_entity_type,target_source_key)
);
create index if not exists integration_relations_target_idx on public.integration_udm_relations(organization_id,to_entity_type,target_source_key,status);

create table if not exists public.integration_match_candidates (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 entity_type text not null,
 pipeline_record_id uuid not null references public.integration_pipeline_records(id) on delete cascade,
 candidate_record_id uuid not null references public.integration_udm_records(id) on delete cascade,
 score numeric(5,4) not null,
 strategy text not null,
 status text not null default 'pending',
 evidence jsonb not null default '{}',
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 constraint integration_match_entity_check check (entity_type in ('organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event')),
 constraint integration_match_score_check check (score between 0 and 1),
 constraint integration_match_status_check check (status in ('pending','accepted','rejected','auto_merged')),
 unique(pipeline_record_id,candidate_record_id,strategy)
);
create index if not exists integration_match_pending_idx on public.integration_match_candidates(organization_id,status,score desc);

create table if not exists public.integration_quality_issues (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid references public.integration_connections(id) on delete cascade,
 raw_batch_id uuid references public.integration_raw_batches(id) on delete set null,
 pipeline_run_id uuid references public.integration_pipeline_runs(id) on delete set null,
 pipeline_record_id uuid references public.integration_pipeline_records(id) on delete set null,
 unified_record_id uuid references public.integration_udm_records(id) on delete set null,
 severity text not null,
 category text not null,
 rule_key text not null,
 field_path text,
 message text not null,
 source_value jsonb,
 status text not null default 'open',
 resolution_note text,
 resolved_by uuid references auth.users(id),
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_quality_severity_check check (severity in ('info','warning','error','critical')),
 constraint integration_quality_category_check check (category in ('validation','missing','duplicate','reference','timezone','currency','unit','mapping','processing')),
 constraint integration_quality_status_check check (status in ('open','resolved','ignored'))
);
create index if not exists integration_quality_open_idx on public.integration_quality_issues(organization_id,status,severity,created_at desc);
create index if not exists integration_quality_connection_idx on public.integration_quality_issues(connection_id,created_at desc);
create index if not exists integration_quality_record_idx on public.integration_quality_issues(unified_record_id) where unified_record_id is not null;

create table if not exists public.integration_health_snapshots (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid references public.integration_connections(id) on delete cascade,
 status text not null default 'unknown',
 freshness_seconds integer,
 success_rate numeric(5,2) not null default 0,
 quality_score numeric(5,2) not null default 0,
 processing_lag_seconds integer,
 queue_depth integer not null default 0,
 dead_jobs integer not null default 0,
 open_issues integer not null default 0,
 invalid_ratio numeric(6,5) not null default 0,
 metrics jsonb not null default '{}',
 captured_at timestamptz not null default now(),
 constraint integration_health_status_check check (status in ('healthy','degraded','unhealthy','unknown')),
 constraint integration_health_success_check check (success_rate between 0 and 100),
 constraint integration_health_quality_check check (quality_score between 0 and 100),
 constraint integration_health_invalid_check check (invalid_ratio between 0 and 1)
);
create index if not exists integration_health_connection_idx on public.integration_health_snapshots(connection_id,captured_at desc);
create index if not exists integration_health_org_idx on public.integration_health_snapshots(organization_id,captured_at desc);

create table if not exists public.integration_audit_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid references public.integration_connections(id) on delete set null,
 actor_id uuid references auth.users(id) on delete set null,
 event_type text not null,
 entity_type text,
 entity_id uuid,
 severity text not null default 'info',
 metadata jsonb not null default '{}',
 occurred_at timestamptz not null default now(),
 constraint integration_audit_severity_check check (severity in ('debug','info','warning','error','critical'))
);
create index if not exists integration_audit_org_idx on public.integration_audit_events(organization_id,occurred_at desc);
create index if not exists integration_audit_connection_idx on public.integration_audit_events(connection_id,occurred_at desc);

create or replace function public.integration_upsert_udm_record(
 target_organization uuid,
 target_entity_type text,
 target_identity_hash text,
 target_natural_key text,
 target_external_id text,
 target_canonical_data jsonb,
 target_quality_score numeric,
 target_currency_code text,
 target_timezone text,
 target_unit_code text,
 target_quantity numeric,
 target_source_created_at timestamptz,
 target_source_updated_at timestamptz
) returns public.integration_udm_records
language plpgsql security definer set search_path=public,auth as $$
declare unified public.integration_udm_records;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 insert into public.integration_udm_records(organization_id,entity_type,identity_hash,natural_key,external_id,canonical_data,quality_score,currency_code,timezone,unit_code,quantity,source_created_at,source_updated_at)
 values(target_organization,target_entity_type,target_identity_hash,target_natural_key,target_external_id,coalesce(target_canonical_data,'{}'::jsonb),greatest(0,least(coalesce(target_quality_score,0),100)),target_currency_code,coalesce(target_timezone,'UTC'),target_unit_code,target_quantity,target_source_created_at,target_source_updated_at)
 on conflict(organization_id,entity_type,identity_hash) do update set
  natural_key=coalesce(excluded.natural_key,public.integration_udm_records.natural_key),
  external_id=coalesce(excluded.external_id,public.integration_udm_records.external_id),
  canonical_data=public.integration_udm_records.canonical_data||excluded.canonical_data,
  quality_score=greatest(public.integration_udm_records.quality_score,excluded.quality_score),
  currency_code=coalesce(excluded.currency_code,public.integration_udm_records.currency_code),
  timezone=coalesce(excluded.timezone,public.integration_udm_records.timezone),
  unit_code=coalesce(excluded.unit_code,public.integration_udm_records.unit_code),
  quantity=coalesce(excluded.quantity,public.integration_udm_records.quantity),
  source_created_at=coalesce(public.integration_udm_records.source_created_at,excluded.source_created_at),
  source_updated_at=greatest(public.integration_udm_records.source_updated_at,excluded.source_updated_at),
  source_count=public.integration_udm_records.source_count+1,
  last_seen_at=now(),updated_at=now()
 returning * into unified;
 return unified;
end;$$;

create or replace function public.integration_admin_set_feature_flag(flag_key text,flag_enabled boolean,target_organization uuid default null)
returns void language plpgsql security definer set search_path=public,private,auth as $$
begin
 if not private.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 update public.integration_feature_flags set enabled=flag_enabled,updated_by=auth.uid(),updated_at=now() where key=flag_key and organization_id is not distinct from target_organization;
 if not found then insert into public.integration_feature_flags(organization_id,key,enabled,created_by,updated_by) values(target_organization,flag_key,flag_enabled,auth.uid(),auth.uid()); end if;
end;$$;

create or replace function public.integration_admin_set_connection_state(target_connection uuid,target_status text)
returns void language plpgsql security definer set search_path=public,private,auth as $$
begin
 if not private.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_status not in ('active','paused') then raise exception 'Invalid status' using errcode='22023'; end if;
 update public.integration_connections set status=target_status,updated_by=auth.uid(),updated_at=now() where id=target_connection and deleted_at is null;
 if not found then raise exception 'Connection not found' using errcode='P0002'; end if;
end;$$;

create or replace function public.integration_admin_enqueue_sync(target_connection uuid,sync_mode text default 'incremental')
returns uuid language plpgsql security definer set search_path=public,private,auth as $$
declare target_org uuid;queued public.integration_jobs;
begin
 if not private.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 if sync_mode not in ('initial','incremental') then raise exception 'Invalid sync mode' using errcode='22023'; end if;
 select organization_id into target_org from public.integration_connections where id=target_connection and deleted_at is null and status='active';
 if target_org is null then raise exception 'Connection not active' using errcode='P0001'; end if;
 insert into public.integration_jobs(organization_id,connection_id,job_type,payload,idempotency_key,created_by)
 values(target_org,target_connection,case when sync_mode='initial' then 'sync.initial' else 'sync.incremental' end,'{}'::jsonb,'admin:'||sync_mode||':'||target_connection::text||':'||to_char(now(),'YYYYMMDDHH24MI'),auth.uid())
 on conflict(organization_id,idempotency_key) where idempotency_key is not null do update set updated_at=public.integration_jobs.updated_at returning * into queued;
 return queued.id;
end;$$;

create or replace function public.integration_admin_backfill_raw_batches(batch_limit integer default 100)
returns integer language plpgsql security definer set search_path=public,private,auth as $$
declare item record;enqueued integer:=0;
begin
 if not private.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 for item in
  select b.id,b.organization_id,b.connection_id from public.integration_raw_batches b
  left join public.integration_pipeline_runs r on r.raw_batch_id=b.id
  where r.id is null order by b.created_at asc limit greatest(1,least(batch_limit,1000))
 loop
  insert into public.integration_jobs(organization_id,connection_id,job_type,payload,idempotency_key,created_by)
  values(item.organization_id,item.connection_id,'pipeline.process_batch',jsonb_build_object('raw_batch_id',item.id),'pipeline:'||item.id::text,auth.uid())
  on conflict(organization_id,idempotency_key) where idempotency_key is not null do nothing;
  enqueued:=enqueued+1;
 end loop;
 return enqueued;
end;$$;

create or replace function public.integration_admin_resolve_quality_issue(target_issue uuid,target_status text,resolution text default null)
returns void language plpgsql security definer set search_path=public,private,auth as $$
begin
 if not private.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_status not in ('resolved','ignored') then raise exception 'Invalid status' using errcode='22023'; end if;
 update public.integration_quality_issues set status=target_status,resolution_note=resolution,resolved_by=auth.uid(),resolved_at=now(),updated_at=now() where id=target_issue and status='open';
 if not found then raise exception 'Issue not found' using errcode='P0002'; end if;
end;$$;

create or replace function public.integration_quality_dashboard()
returns jsonb language plpgsql security definer set search_path=public,private,auth as $$
begin
 if not private.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 return jsonb_build_object(
  'connections',jsonb_build_object('total',(select count(*) from public.integration_connections where deleted_at is null),'active',(select count(*) from public.integration_connections where status='active' and deleted_at is null),'error',(select count(*) from public.integration_connections where status='error' and deleted_at is null)),
  'pipeline',jsonb_build_object('runs_24h',(select count(*) from public.integration_pipeline_runs where started_at>=now()-interval '24 hours'),'failed_24h',(select count(*) from public.integration_pipeline_runs where started_at>=now()-interval '24 hours' and status='failed'),'records_24h',(select coalesce(sum(total_records),0) from public.integration_pipeline_runs where started_at>=now()-interval '24 hours'),'unified_24h',(select coalesce(sum(unified_records),0) from public.integration_pipeline_runs where started_at>=now()-interval '24 hours')),
  'quality',jsonb_build_object('open',(select count(*) from public.integration_quality_issues where status='open'),'critical',(select count(*) from public.integration_quality_issues where status='open' and severity='critical'),'duplicates',(select count(*) from public.integration_quality_issues where status='open' and category='duplicate'),'missing',(select count(*) from public.integration_quality_issues where status='open' and category='missing')),
  'udm',jsonb_build_object('records',(select count(*) from public.integration_udm_records),'entities',(select count(distinct entity_type) from public.integration_udm_records)),
  'queue',jsonb_build_object('queued',(select count(*) from public.integration_jobs where status='queued'),'dead',(select count(*) from public.integration_jobs where status='dead')),
  'generated_at',now()
 );
end;$$;

revoke all on function public.integration_upsert_udm_record(uuid,text,text,text,text,jsonb,numeric,text,text,text,numeric,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.integration_upsert_udm_record(uuid,text,text,text,text,jsonb,numeric,text,text,text,numeric,timestamptz,timestamptz) to service_role;
revoke all on function public.integration_admin_set_feature_flag(text,boolean,uuid) from public,anon;
revoke all on function public.integration_admin_set_connection_state(uuid,text) from public,anon;
revoke all on function public.integration_admin_enqueue_sync(uuid,text) from public,anon;
revoke all on function public.integration_admin_backfill_raw_batches(integer) from public,anon;
revoke all on function public.integration_admin_resolve_quality_issue(uuid,text,text) from public,anon;
revoke all on function public.integration_quality_dashboard() from public,anon;
grant execute on function public.integration_admin_set_feature_flag(text,boolean,uuid),public.integration_admin_set_connection_state(uuid,text),public.integration_admin_enqueue_sync(uuid,text),public.integration_admin_backfill_raw_batches(integer),public.integration_admin_resolve_quality_issue(uuid,text,text),public.integration_quality_dashboard() to authenticated,service_role;

alter table public.integration_mapping_rules enable row level security;
alter table public.integration_validation_rules enable row level security;
alter table public.integration_pipeline_runs enable row level security;
alter table public.integration_pipeline_records enable row level security;
alter table public.integration_udm_records enable row level security;
alter table public.integration_udm_source_keys enable row level security;
alter table public.integration_udm_relations enable row level security;
alter table public.integration_match_candidates enable row level security;
alter table public.integration_quality_issues enable row level security;
alter table public.integration_health_snapshots enable row level security;
alter table public.integration_audit_events enable row level security;

create policy "integration mapping read" on public.integration_mapping_rules for select to authenticated using (private.is_admin() or (organization_id is not null and private.is_organization_member(organization_id)));
create policy "integration validation read" on public.integration_validation_rules for select to authenticated using (private.is_admin() or (organization_id is not null and private.is_organization_member(organization_id)));
create policy "integration pipeline run read" on public.integration_pipeline_runs for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
create policy "integration pipeline record read" on public.integration_pipeline_records for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
create policy "integration udm read" on public.integration_udm_records for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
create policy "integration source key read" on public.integration_udm_source_keys for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
create policy "integration relation read" on public.integration_udm_relations for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
create policy "integration match read" on public.integration_match_candidates for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
create policy "integration quality read" on public.integration_quality_issues for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
create policy "integration health read" on public.integration_health_snapshots for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
create policy "integration audit read" on public.integration_audit_events for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));

revoke all on public.integration_mapping_rules,public.integration_validation_rules,public.integration_pipeline_runs,public.integration_pipeline_records,public.integration_udm_records,public.integration_udm_source_keys,public.integration_udm_relations,public.integration_match_candidates,public.integration_quality_issues,public.integration_health_snapshots,public.integration_audit_events from anon,authenticated;
grant select on public.integration_mapping_rules,public.integration_validation_rules,public.integration_pipeline_runs,public.integration_pipeline_records,public.integration_udm_records,public.integration_udm_source_keys,public.integration_udm_relations,public.integration_match_candidates,public.integration_quality_issues,public.integration_health_snapshots,public.integration_audit_events to authenticated;
grant all on public.integration_mapping_rules,public.integration_validation_rules,public.integration_pipeline_runs,public.integration_pipeline_records,public.integration_udm_records,public.integration_udm_source_keys,public.integration_udm_relations,public.integration_match_candidates,public.integration_quality_issues,public.integration_health_snapshots,public.integration_audit_events to service_role;

create or replace trigger integration_mapping_touch before update on public.integration_mapping_rules for each row execute function public.touch_updated_at();
create or replace trigger integration_validation_touch before update on public.integration_validation_rules for each row execute function public.touch_updated_at();
create or replace trigger integration_pipeline_runs_touch before update on public.integration_pipeline_runs for each row execute function public.touch_updated_at();
create or replace trigger integration_pipeline_records_touch before update on public.integration_pipeline_records for each row execute function public.touch_updated_at();
create or replace trigger integration_udm_touch before update on public.integration_udm_records for each row execute function public.touch_updated_at();
create or replace trigger integration_relations_touch before update on public.integration_udm_relations for each row execute function public.touch_updated_at();
create or replace trigger integration_quality_touch before update on public.integration_quality_issues for each row execute function public.touch_updated_at();

comment on table public.integration_udm_records is 'Canonical unified data model records. Business calculations remain in MADAR application code.';
comment on table public.integration_pipeline_records is 'Per-record lineage through Source → Raw → Validate → Transform → Map → Deduplicate → Unified.';
comment on table public.integration_quality_issues is 'Actionable data quality findings for the Quality Center and Audit Center.';
comment on table public.integration_health_snapshots is 'Connection and pipeline health measurements; ORBY may interpret but never calculate these values.';

notify pgrst,'reload schema';
commit;
