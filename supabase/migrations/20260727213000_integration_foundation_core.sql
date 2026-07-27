begin;

create table if not exists public.integration_connectors (
 connector_key text primary key,
 version text not null,
 display_name text not null,
 description text not null default '',
 auth_schemes text[] not null default '{}',
 capabilities jsonb not null default '{}',
 internal_only boolean not null default false,
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_connectors_key_format check (connector_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
 constraint integration_connectors_version_format check (version ~ '^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$')
);

create table if not exists public.integration_connections (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connector_key text not null references public.integration_connectors(connector_key),
 connector_version text not null,
 name text not null,
 status text not null default 'draft',
 connection_mode text not null default 'READ_ONLY',
 auth_scheme text not null,
 config jsonb not null default '{}',
 secret_id uuid,
 last_tested_at timestamptz,
 last_success_at timestamptz,
 last_error_code text,
 last_error_message text,
 created_by uuid not null references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 constraint integration_connections_status_check check (status in ('draft','verifying','active','paused','error','disconnected','archived')),
 constraint integration_connections_mode_check check (connection_mode in ('READ_ONLY','WRITE_LIMITED')),
 constraint integration_connections_auth_check check (auth_scheme in ('none','api_key','bearer','basic','oauth2','database','custom')),
 constraint integration_connections_name_check check (char_length(name) between 2 and 120)
);
create unique index if not exists integration_connections_org_name_active_idx on public.integration_connections(organization_id,lower(name)) where deleted_at is null;
create index if not exists integration_connections_org_idx on public.integration_connections(organization_id,status) where deleted_at is null;

create table if not exists public.integration_connection_secrets (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.integration_connections(id) on delete cascade,
 encrypted_payload text not null,
 iv text not null,
 auth_tag text not null,
 algorithm text not null default 'aes-256-gcm',
 key_version integer not null default 1,
 metadata jsonb not null default '{}',
 expires_at timestamptz,
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 constraint integration_secret_algorithm_check check (algorithm='aes-256-gcm'),
 constraint integration_secret_key_version_check check (key_version>0)
);
create unique index if not exists integration_connection_one_active_secret_idx on public.integration_connection_secrets(connection_id) where revoked_at is null;
create index if not exists integration_connection_secrets_org_idx on public.integration_connection_secrets(organization_id,connection_id);
alter table public.integration_connections drop constraint if exists integration_connections_secret_id_fkey;
alter table public.integration_connections add constraint integration_connections_secret_id_fkey foreign key(secret_id) references public.integration_connection_secrets(id) on delete set null;

create table if not exists public.integration_schedules (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null unique references public.integration_connections(id) on delete cascade,
 sync_mode text not null default 'incremental',
 interval_seconds integer not null default 900,
 enabled boolean not null default true,
 next_run_at timestamptz not null default now(),
 last_enqueued_at timestamptz,
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_schedule_mode_check check (sync_mode in ('initial','incremental')),
 constraint integration_schedule_interval_check check (interval_seconds between 300 and 86400)
);
create index if not exists integration_schedules_due_idx on public.integration_schedules(next_run_at) where enabled;

create table if not exists public.integration_jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid references public.integration_connections(id) on delete cascade,
 job_type text not null,
 status text not null default 'queued',
 payload jsonb not null default '{}',
 priority smallint not null default 100,
 available_at timestamptz not null default now(),
 attempts smallint not null default 0,
 max_attempts smallint not null default 8,
 idempotency_key text,
 locked_at timestamptz,
 locked_by text,
 lease_expires_at timestamptz,
 result jsonb not null default '{}',
 last_error_code text,
 last_error_message text,
 created_by uuid references auth.users(id),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_jobs_type_check check (job_type in ('connection.test','sync.initial','sync.incremental')),
 constraint integration_jobs_status_check check (status in ('queued','running','succeeded','dead','cancelled')),
 constraint integration_jobs_attempts_check check (attempts>=0 and max_attempts between 1 and 30)
);
create unique index if not exists integration_jobs_idempotency_idx on public.integration_jobs(organization_id,idempotency_key) where idempotency_key is not null;
create index if not exists integration_jobs_claim_idx on public.integration_jobs(status,available_at,priority,created_at) where status in ('queued','running');
create index if not exists integration_jobs_connection_idx on public.integration_jobs(connection_id,created_at desc);

create table if not exists public.integration_job_attempts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 job_id uuid not null references public.integration_jobs(id) on delete cascade,
 attempt_no smallint not null,
 worker_id text not null,
 status text not null default 'running',
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 error_code text,
 error_message text,
 metadata jsonb not null default '{}',
 constraint integration_attempt_status_check check (status in ('running','succeeded','failed','abandoned')),
 unique(job_id,attempt_no)
);
create index if not exists integration_job_attempts_org_idx on public.integration_job_attempts(organization_id,started_at desc);

create table if not exists public.integration_sync_runs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.integration_connections(id) on delete cascade,
 job_id uuid references public.integration_jobs(id) on delete set null,
 sync_mode text not null,
 status text not null default 'running',
 records_received bigint not null default 0,
 batches_received integer not null default 0,
 checkpoint_before jsonb not null default '{}',
 checkpoint_after jsonb not null default '{}',
 error_code text,
 error_message text,
 metadata jsonb not null default '{}',
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 constraint integration_sync_mode_check check (sync_mode in ('initial','incremental')),
 constraint integration_sync_status_check check (status in ('running','succeeded','failed','cancelled'))
);
create index if not exists integration_sync_runs_connection_idx on public.integration_sync_runs(connection_id,started_at desc);

create table if not exists public.integration_sync_checkpoints (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.integration_connections(id) on delete cascade,
 stream_key text not null,
 cursor jsonb,
 watermark timestamptz,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 constraint integration_checkpoint_version_check check (version>0),
 unique(connection_id,stream_key)
);
create index if not exists integration_checkpoints_org_idx on public.integration_sync_checkpoints(organization_id,connection_id);

create table if not exists public.integration_raw_batches (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.integration_connections(id) on delete cascade,
 sync_run_id uuid not null references public.integration_sync_runs(id) on delete cascade,
 stream_key text not null,
 records jsonb not null,
 record_count integer not null default 0,
 cursor jsonb,
 watermark timestamptz,
 idempotency_key text not null,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 constraint integration_raw_record_count_check check (record_count>=0),
 unique(connection_id,idempotency_key)
);
create index if not exists integration_raw_batches_run_idx on public.integration_raw_batches(sync_run_id,created_at);
create index if not exists integration_raw_batches_org_idx on public.integration_raw_batches(organization_id,connection_id,stream_key);

create table if not exists public.integration_idempotency_keys (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 scope text not null,
 idempotency_key text not null,
 status text not null default 'started',
 response jsonb not null default '{}',
 expires_at timestamptz not null default (now()+interval '7 days'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_idempotency_status_check check (status in ('started','completed','failed')),
 unique(organization_id,scope,idempotency_key)
);
create index if not exists integration_idempotency_expiry_idx on public.integration_idempotency_keys(expires_at);

create table if not exists public.integration_feature_flags (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 key text not null,
 enabled boolean not null default false,
 config jsonb not null default '{}',
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint integration_feature_key_check check (key in ('integration_engine_enabled','integration_worker_enabled','integration_scheduler_enabled','integration_write_enabled'))
);
create unique index if not exists integration_feature_flags_global_idx on public.integration_feature_flags(key) where organization_id is null;
create unique index if not exists integration_feature_flags_workspace_idx on public.integration_feature_flags(organization_id,key) where organization_id is not null;

insert into public.integration_connectors(connector_key,version,display_name,description,auth_schemes,capabilities,internal_only,enabled)
values ('madar-diagnostic','1.0.0','MADAR Diagnostic Connector','Internal deterministic connector used to verify the integration engine contract.',array['none'],jsonb_build_object('read',true,'write',false,'polling',true),true,false)
on conflict(connector_key) do update set version=excluded.version,display_name=excluded.display_name,description=excluded.description,auth_schemes=excluded.auth_schemes,capabilities=excluded.capabilities,internal_only=excluded.internal_only,updated_at=now();

insert into public.integration_feature_flags(organization_id,key,enabled)
values
 (null,'integration_engine_enabled',false),
 (null,'integration_worker_enabled',false),
 (null,'integration_scheduler_enabled',false),
 (null,'integration_write_enabled',false)
on conflict do nothing;

create or replace function public.integration_enqueue_job(
 target_organization uuid,
 target_connection uuid,
 job_type text,
 job_payload jsonb default '{}'::jsonb,
 job_priority smallint default 100,
 job_available_at timestamptz default now(),
 job_max_attempts smallint default 8,
 job_idempotency_key text default null,
 job_created_by uuid default null
) returns public.integration_jobs
language plpgsql security definer set search_path=public,private,auth as $$
declare queued public.integration_jobs;
begin
 if auth.role()<>'service_role' and not private.has_organization_role(target_organization,array['OWNER','ADMIN']::public.organization_role[]) then raise exception 'Not authorized' using errcode='42501'; end if;
 if target_connection is not null and not exists(select 1 from public.integration_connections c where c.id=target_connection and c.organization_id=target_organization and c.deleted_at is null) then raise exception 'Connection not found' using errcode='P0002'; end if;
 insert into public.integration_jobs(organization_id,connection_id,job_type,payload,priority,available_at,max_attempts,idempotency_key,created_by)
 values(target_organization,target_connection,integration_enqueue_job.job_type,coalesce(job_payload,'{}'::jsonb),job_priority,job_available_at,job_max_attempts,job_idempotency_key,coalesce(job_created_by,auth.uid()))
 on conflict(organization_id,idempotency_key) where idempotency_key is not null do update set updated_at=public.integration_jobs.updated_at
 returning * into queued;
 return queued;
end;$$;

create or replace function public.integration_claim_jobs(worker_id text,claim_limit integer default 5,lease_seconds integer default 120)
returns setof public.integration_jobs
language plpgsql security definer set search_path=public,auth as $$
declare claimed public.integration_jobs%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 for claimed in
  with candidates as (
   select j.id from public.integration_jobs j
   where j.attempts<j.max_attempts and ((j.status='queued' and j.available_at<=now()) or (j.status='running' and j.lease_expires_at<now()))
   order by j.priority asc,j.available_at asc,j.created_at asc
   for update skip locked limit greatest(1,least(claim_limit,20))
  )
  update public.integration_jobs j set status='running',attempts=j.attempts+1,locked_at=now(),locked_by=worker_id,lease_expires_at=now()+make_interval(secs=>greatest(30,least(lease_seconds,900))),updated_at=now()
  from candidates c where j.id=c.id returning j.*
 loop
  insert into public.integration_job_attempts(organization_id,job_id,attempt_no,worker_id,status) values(claimed.organization_id,claimed.id,claimed.attempts,worker_id,'running') on conflict do nothing;
  return next claimed;
 end loop;
end;$$;

create or replace function public.integration_heartbeat_job(target_job uuid,worker_id text,lease_seconds integer default 120)
returns boolean language plpgsql security definer set search_path=public,auth as $$
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 update public.integration_jobs set lease_expires_at=now()+make_interval(secs=>greatest(30,least(lease_seconds,900))),updated_at=now() where id=target_job and status='running' and locked_by=worker_id;
 return found;
end;$$;

create or replace function public.integration_complete_job(target_job uuid,worker_id text,job_result jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare current_attempt smallint;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 update public.integration_jobs set status='succeeded',result=coalesce(job_result,'{}'::jsonb),completed_at=now(),locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now() where id=target_job and status='running' and locked_by=worker_id returning attempts into current_attempt;
 if not found then return false; end if;
 update public.integration_job_attempts set status='succeeded',finished_at=now() where job_id=target_job and attempt_no=current_attempt;
 return true;
end;$$;

create or replace function public.integration_fail_job(target_job uuid,worker_id text,error_code text,error_message text,next_attempt_at timestamptz default null)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare current_attempt smallint;maximum_attempts smallint;next_status text;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 select attempts,max_attempts into current_attempt,maximum_attempts from public.integration_jobs where id=target_job and status='running' and locked_by=worker_id for update;
 if not found then return false; end if;
 next_status:=case when next_attempt_at is not null and current_attempt<maximum_attempts then 'queued' else 'dead' end;
 update public.integration_jobs set status=next_status,available_at=coalesce(next_attempt_at,available_at),last_error_code=integration_fail_job.error_code,last_error_message=left(integration_fail_job.error_message,1000),locked_at=null,locked_by=null,lease_expires_at=null,completed_at=case when next_status='dead' then now() else null end,updated_at=now() where id=target_job;
 update public.integration_job_attempts set status='failed',finished_at=now(),error_code=integration_fail_job.error_code,error_message=left(integration_fail_job.error_message,1000) where job_id=target_job and attempt_no=current_attempt;
 return true;
end;$$;

create or replace function public.integration_enqueue_due_schedules(schedule_limit integer default 50)
returns integer language plpgsql security definer set search_path=public,auth as $$
declare item public.integration_schedules%rowtype;enqueued integer:=0;due_at timestamptz;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 for item in select s.* from public.integration_schedules s join public.integration_connections c on c.id=s.connection_id where s.enabled and s.next_run_at<=now() and c.status='active' and c.deleted_at is null order by s.next_run_at for update of s skip locked limit greatest(1,least(schedule_limit,200))
 loop
  due_at:=item.next_run_at;
  perform public.integration_enqueue_job(item.organization_id,item.connection_id,case when item.sync_mode='initial' then 'sync.initial' else 'sync.incremental' end,'{}'::jsonb,100,now(),8,'schedule:'||item.id::text||':'||extract(epoch from due_at)::bigint,item.updated_by);
  update public.integration_schedules set last_enqueued_at=now(),next_run_at=greatest(now(),due_at)+make_interval(secs=>interval_seconds),updated_at=now() where id=item.id;
  enqueued:=enqueued+1;
 end loop;
 return enqueued;
end;$$;

revoke all on function public.integration_enqueue_job(uuid,uuid,text,jsonb,smallint,timestamptz,smallint,text,uuid) from public,anon,authenticated;
revoke all on function public.integration_claim_jobs(text,integer,integer) from public,anon,authenticated;
revoke all on function public.integration_heartbeat_job(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.integration_complete_job(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.integration_fail_job(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.integration_enqueue_due_schedules(integer) from public,anon,authenticated;
grant execute on function public.integration_enqueue_job(uuid,uuid,text,jsonb,smallint,timestamptz,smallint,text,uuid) to service_role;
grant execute on function public.integration_claim_jobs(text,integer,integer) to service_role;
grant execute on function public.integration_heartbeat_job(uuid,text,integer) to service_role;
grant execute on function public.integration_complete_job(uuid,text,jsonb) to service_role;
grant execute on function public.integration_fail_job(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.integration_enqueue_due_schedules(integer) to service_role;

alter table public.integration_connectors enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_connection_secrets enable row level security;
alter table public.integration_schedules enable row level security;
alter table public.integration_jobs enable row level security;
alter table public.integration_job_attempts enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.integration_sync_checkpoints enable row level security;
alter table public.integration_raw_batches enable row level security;
alter table public.integration_idempotency_keys enable row level security;
alter table public.integration_feature_flags enable row level security;

drop policy if exists "integration connector catalog read" on public.integration_connectors;
create policy "integration connector catalog read" on public.integration_connectors for select to authenticated using (enabled or private.is_admin());
drop policy if exists "integration connection member read" on public.integration_connections;
create policy "integration connection member read" on public.integration_connections for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
drop policy if exists "integration schedule member read" on public.integration_schedules;
create policy "integration schedule member read" on public.integration_schedules for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
drop policy if exists "integration job member read" on public.integration_jobs;
create policy "integration job member read" on public.integration_jobs for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
drop policy if exists "integration attempt member read" on public.integration_job_attempts;
create policy "integration attempt member read" on public.integration_job_attempts for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
drop policy if exists "integration run member read" on public.integration_sync_runs;
create policy "integration run member read" on public.integration_sync_runs for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
drop policy if exists "integration checkpoint member read" on public.integration_sync_checkpoints;
create policy "integration checkpoint member read" on public.integration_sync_checkpoints for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
drop policy if exists "integration raw member read" on public.integration_raw_batches;
create policy "integration raw member read" on public.integration_raw_batches for select to authenticated using (private.is_admin() or private.is_organization_member(organization_id));
drop policy if exists "integration feature member read" on public.integration_feature_flags;
create policy "integration feature member read" on public.integration_feature_flags for select to authenticated using (private.is_admin() or organization_id is null or private.is_organization_member(organization_id));

revoke all on public.integration_connectors,public.integration_connections,public.integration_connection_secrets,public.integration_schedules,public.integration_jobs,public.integration_job_attempts,public.integration_sync_runs,public.integration_sync_checkpoints,public.integration_raw_batches,public.integration_idempotency_keys,public.integration_feature_flags from anon,authenticated;
grant select on public.integration_connectors,public.integration_connections,public.integration_schedules,public.integration_jobs,public.integration_job_attempts,public.integration_sync_runs,public.integration_sync_checkpoints,public.integration_raw_batches,public.integration_feature_flags to authenticated;
grant all on public.integration_connectors,public.integration_connections,public.integration_connection_secrets,public.integration_schedules,public.integration_jobs,public.integration_job_attempts,public.integration_sync_runs,public.integration_sync_checkpoints,public.integration_raw_batches,public.integration_idempotency_keys,public.integration_feature_flags to service_role;

create or replace trigger integration_connectors_touch before update on public.integration_connectors for each row execute function public.touch_updated_at();
create or replace trigger integration_connections_touch before update on public.integration_connections for each row execute function public.touch_updated_at();
create or replace trigger integration_schedules_touch before update on public.integration_schedules for each row execute function public.touch_updated_at();
create or replace trigger integration_jobs_touch before update on public.integration_jobs for each row execute function public.touch_updated_at();
create or replace trigger integration_idempotency_touch before update on public.integration_idempotency_keys for each row execute function public.touch_updated_at();
create or replace trigger integration_feature_flags_touch before update on public.integration_feature_flags for each row execute function public.touch_updated_at();

comment on table public.integration_connection_secrets is 'Encrypted connector credentials. No authenticated browser policy is intentionally defined.';
comment on table public.integration_raw_batches is 'Immutable raw handoff from connector SDK to the future validation and UDM pipeline.';
comment on function public.integration_claim_jobs(text,integer,integer) is 'Claims bounded jobs with SKIP LOCKED and a renewable lease.';

notify pgrst,'reload schema';
commit;
