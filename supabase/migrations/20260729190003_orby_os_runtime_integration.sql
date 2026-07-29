-- ORBY OS v1 runtime integration and complete administrative services.

create table if not exists public.orby_provider_registry (
 id text primary key,
 display_name text not null,
 enabled boolean not null default false,
 priority integer not null default 100,
 capabilities jsonb not null default '{}'::jsonb check(jsonb_typeof(capabilities)='object'),
 limits jsonb not null default '{}'::jsonb check(jsonb_typeof(limits)='object'),
 routing_policy jsonb not null default '{}'::jsonb check(jsonb_typeof(routing_policy)='object'),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists orby_provider_registry_enabled_idx on public.orby_provider_registry(enabled,priority);
create index if not exists orby_provider_registry_created_by_idx on public.orby_provider_registry(created_by) where created_by is not null;
create index if not exists orby_provider_registry_updated_by_idx on public.orby_provider_registry(updated_by) where updated_by is not null;
alter table public.orby_provider_registry enable row level security;
revoke all on table public.orby_provider_registry from public,anon,authenticated,service_role;
grant select on table public.orby_provider_registry to authenticated;
grant select,insert,update,delete on table public.orby_provider_registry to service_role;
drop policy if exists orby_provider_registry_admin_all on public.orby_provider_registry;
create policy orby_provider_registry_admin_all on public.orby_provider_registry for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function public.orby_os_publish_workflow_version(
 target_key text,
 target_name text,
 target_description text,
 target_domain text,
 target_definition jsonb,
 target_input_schema jsonb default '{}'::jsonb,
 target_output_schema jsonb default '{}'::jsonb,
 target_permissions jsonb default '[]'::jsonb,
 target_tags jsonb default '[]'::jsonb,
 target_status text default 'testing'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare workflow_id uuid;version_id uuid;next_version integer;checksum_value text;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if target_key !~ '^[a-z0-9][a-z0-9._-]{2,99}$' then raise exception 'Invalid workflow key' using errcode='22023'; end if;
 if coalesce(trim(target_name),'')='' or coalesce(trim(target_domain),'')='' then raise exception 'Workflow name and domain are required' using errcode='22023'; end if;
 if jsonb_typeof(target_definition)<>'object' or not (target_definition ? 'id') or not (target_definition ? 'type') then raise exception 'Workflow root definition is invalid' using errcode='22023'; end if;
 if target_definition::text ~* '(api[_-]?key|password|access[_-]?token|refresh[_-]?token|provider[_-]?secret|dynamic[_-]?code)' then raise exception 'Workflow definition contains forbidden secret or dynamic-code fields' using errcode='P0001'; end if;
 if target_status not in ('draft','testing','canary','active','paused') then raise exception 'Invalid workflow status' using errcode='22023'; end if;
 insert into public.orby_workflow_definitions(key,name,description,domain,status,required_permissions,tags,metadata,created_by)
 values(target_key,trim(target_name),coalesce(target_description,''),trim(target_domain),target_status,coalesce(target_permissions,'[]'::jsonb),coalesce(target_tags,'[]'::jsonb),jsonb_build_object('managedBy','orby-os-builder'),auth.uid())
 on conflict(key,scope_key) do update set name=excluded.name,description=excluded.description,domain=excluded.domain,status=excluded.status,required_permissions=excluded.required_permissions,tags=excluded.tags,updated_at=now()
 returning id into workflow_id;
 select coalesce(max(version),0)+1 into next_version from public.orby_workflow_versions where workflow_id=workflow_id;
 checksum_value:=encode(extensions.digest(target_definition::text,'sha256'),'hex');
 insert into public.orby_workflow_versions(workflow_id,version,definition,input_schema,output_schema,checksum,max_duration_seconds,status,created_by)
 values(workflow_id,next_version,target_definition,coalesce(target_input_schema,'{}'::jsonb),coalesce(target_output_schema,'{}'::jsonb),checksum_value,3600,target_status,auth.uid()) returning id into version_id;
 return jsonb_build_object('workflow_id',workflow_id,'version_id',version_id,'version',next_version,'checksum',checksum_value,'status',target_status);
end $$;

create or replace function public.orby_os_publish_prompt_version(
 target_key text,
 target_domain text,
 target_content text,
 target_status text default 'testing',
 target_organization uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare next_version integer;prompt_id uuid;checksum_value text;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if target_key !~ '^[a-z0-9][a-z0-9._-]{2,99}$' or coalesce(trim(target_content),'')='' then raise exception 'Invalid prompt input' using errcode='22023'; end if;
 if target_content ~* '(sk-[a-z0-9]|sb_secret_|password\s*[:=]|api[_-]?key\s*[:=])' then raise exception 'Prompt contains a possible secret' using errcode='P0001'; end if;
 if target_status not in ('draft','testing','canary','active','paused') then raise exception 'Invalid prompt status' using errcode='22023'; end if;
 select coalesce(max(version),0)+1 into next_version from public.orby_prompt_versions where key=target_key and organization_id is not distinct from target_organization;
 checksum_value:=encode(extensions.digest(target_content,'sha256'),'hex');
 insert into public.orby_prompt_versions(organization_id,domain,key,version,content,checksum,status,created_by)
 values(target_organization,coalesce(nullif(trim(target_domain),''),'core'),target_key,next_version,target_content,checksum_value,target_status,auth.uid()) returning id into prompt_id;
 return jsonb_build_object('prompt_id',prompt_id,'version',next_version,'checksum',checksum_value,'status',target_status);
end $$;

create or replace function public.orby_os_set_provider_state(target_provider text,target_enabled boolean,target_priority integer default 100)
returns public.orby_provider_registry
language plpgsql
security definer
set search_path=''
as $$
declare result public.orby_provider_registry;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if target_enabled then raise exception 'Provider activation remains deferred until credentials and provider review are completed' using errcode='P0001'; end if;
 update public.orby_provider_registry set enabled=false,priority=greatest(0,target_priority),updated_by=auth.uid(),updated_at=now() where id=target_provider returning * into result;
 if result.id is null then raise exception 'Provider not found' using errcode='P0002'; end if;
 return result;
end $$;

create or replace function public.orby_os_restore_backup(target_backup uuid,dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare record public.orby_backups;computed text;sections jsonb;item jsonb;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 select * into record from public.orby_backups where id=target_backup for update;
 if record.id is null or record.status not in ('ready','restored') then raise exception 'Backup unavailable' using errcode='P0002'; end if;
 computed:=encode(extensions.digest(record.snapshot::text,'sha256'),'hex');
 if computed<>record.checksum then raise exception 'Backup checksum mismatch' using errcode='P0001'; end if;
 select coalesce(jsonb_agg(key),'[]'::jsonb) into sections from jsonb_object_keys(record.snapshot) as key;
 if dry_run then return jsonb_build_object('valid',true,'dry_run',true,'backup_id',record.id,'organization_id',record.organization_id,'sections',sections); end if;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'feature_flags','[]'::jsonb)) loop
  insert into public.orby_feature_flags(key,organization_id,workspace_id,user_id,environment,enabled,rollout_percentage,starts_at,ends_at,configuration,updated_by)
  values(item->>'key',nullif(item->>'organization_id','')::uuid,nullif(item->>'workspace_id','')::uuid,nullif(item->>'user_id','')::uuid,nullif(item->>'environment',''),coalesce((item->>'enabled')::boolean,false),coalesce((item->>'rollout_percentage')::integer,0),nullif(item->>'starts_at','')::timestamptz,nullif(item->>'ends_at','')::timestamptz,coalesce(item->'configuration','{}'::jsonb),auth.uid())
  on conflict(key,scope_key) do update set enabled=excluded.enabled,rollout_percentage=excluded.rollout_percentage,starts_at=excluded.starts_at,ends_at=excluded.ends_at,configuration=excluded.configuration,updated_by=auth.uid(),updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'governance_policies','[]'::jsonb)) loop
  insert into public.orby_governance_policies(key,organization_id,workspace_id,name,description,priority,enabled,immutable,effect,approval_scope,conditions,limits,metadata,updated_by)
  values(item->>'key',nullif(item->>'organization_id','')::uuid,nullif(item->>'workspace_id','')::uuid,item->>'name',item->>'description',coalesce((item->>'priority')::integer,100),coalesce((item->>'enabled')::boolean,true),coalesce((item->>'immutable')::boolean,false),item->>'effect',nullif(item->>'approval_scope',''),coalesce(item->'conditions','{}'::jsonb),coalesce(item->'limits','{}'::jsonb),coalesce(item->'metadata','{}'::jsonb),auth.uid())
  on conflict(key,scope_key) do update set name=excluded.name,description=excluded.description,priority=excluded.priority,enabled=excluded.enabled,immutable=excluded.immutable,effect=excluded.effect,approval_scope=excluded.approval_scope,conditions=excluded.conditions,limits=excluded.limits,metadata=excluded.metadata,updated_by=auth.uid(),updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'budgets','[]'::jsonb)) loop
  insert into public.orby_budgets(organization_id,workspace_id,user_id,period,limit_amount,currency,warning_percentage,hard_stop,enabled,updated_by)
  values(nullif(item->>'organization_id','')::uuid,nullif(item->>'workspace_id','')::uuid,nullif(item->>'user_id','')::uuid,item->>'period',coalesce((item->>'limit_amount')::numeric,0),coalesce(item->>'currency','USD'),coalesce((item->>'warning_percentage')::integer,80),coalesce((item->>'hard_stop')::boolean,true),coalesce((item->>'enabled')::boolean,false),auth.uid())
  on conflict(scope_key,period,currency) do update set limit_amount=excluded.limit_amount,warning_percentage=excluded.warning_percentage,hard_stop=excluded.hard_stop,enabled=excluded.enabled,updated_by=auth.uid(),updated_at=now();
 end loop;
 update public.orby_backups set status='restored',restored_at=now() where id=record.id;
 return jsonb_build_object('valid',true,'dry_run',false,'backup_id',record.id,'status','restored','sections',sections);
end $$;

create or replace function public.orby_os_self_test()
returns jsonb
language sql
security definer
set search_path=''
as $$
 select case when private.is_admin() then jsonb_build_object(
  'stage4_tables',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('orby_os_releases','orby_feature_flags','orby_workflow_definitions','orby_workflow_versions','orby_workflow_templates','orby_plugins','orby_plugin_versions','orby_plugin_installations','orby_domain_plugins','orby_prompt_versions','orby_governance_policies','orby_traces','orby_trace_spans','orby_cost_events','orby_budgets','orby_evaluation_suites','orby_evaluation_cases','orby_evaluation_runs','orby_evaluation_results','orby_backups','orby_channels','orby_channel_bindings','orby_data_governance_requests','orby_provider_circuits','orby_provider_registry')),
  'rls_tables',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and c.relname like 'orby_%'),
  'workflow_templates',(select count(*) from public.orby_workflow_templates where enabled),
  'domain_plugins',(select count(*) from public.orby_domain_plugins where enabled),
  'immutable_policies',(select count(*) from public.orby_governance_policies where enabled and immutable),
  'deferred_gates_closed',(select count(*)=3 from public.orby_feature_flags where key in ('orby_provider_execution_enabled','orby_ocr_enabled','orby_external_channels_enabled') and not enabled and rollout_percentage=0),
  'external_channels_active',(select count(*) from public.orby_channels where key<>'in_app' and status='active'),
  'enabled_models',(select count(*) from public.orby_model_registry where enabled),
  'enabled_providers',(select count(*) from public.orby_provider_registry where enabled),
  'memory_isolation_policy',(select count(*)>0 from pg_catalog.pg_policies where schemaname='public' and tablename='orby_memories' and policyname='orby_memories_user_select'),
  'notification_isolation_policy',(select count(*)>0 from pg_catalog.pg_policies where schemaname='public' and tablename='orby_proactive_notifications' and policyname='orby_proactive_notifications_user_select'),
  'generated_at',now()
 ) else private.raise_forbidden() end
$$;

create or replace function public.orby_os_admin_dashboard()
returns jsonb
language sql
security definer
set search_path=''
as $$
 select case when private.is_admin() then jsonb_build_object(
  'release',coalesce((select jsonb_build_object('version',version,'status',status,'rollout',rollout_percentage) from public.orby_os_releases where component='core' and component_key='orby-os' order by created_at desc limit 1),'{}'::jsonb),
  'providers',jsonb_build_object('catalog',(select count(*) from public.orby_provider_registry),'enabled',(select count(*) from public.orby_provider_registry where enabled),'healthy',(select count(*) from public.orby_provider_health where ok)),
  'models',jsonb_build_object('catalog',(select count(*) from public.orby_model_registry),'enabled',(select count(*) from public.orby_model_registry where enabled)),
  'tools',jsonb_build_object('catalog',(select count(*) from public.orby_tool_catalog),'enabled',(select count(*) from public.orby_tool_catalog where enabled)),
  'memory',jsonb_build_object('policies',(select count(*) from public.orby_memory_policies where enabled),'records',(select count(*) from public.orby_memories where deleted_at is null)),
  'knowledge',jsonb_build_object('sources',(select count(*) from public.orby_knowledge_sources),'ready_sources',(select count(*) from public.orby_knowledge_sources where status='ready'),'documents',(select count(*) from public.orby_knowledge_documents),'failed_documents',(select count(*) from public.orby_knowledge_documents where status='failed')),
  'proactive',jsonb_build_object('schedules',(select count(*) from public.orby_intelligence_schedules where enabled),'queued_jobs',(select count(*) from public.orby_intelligence_jobs where status in ('queued','retry')),'dead_jobs',(select count(*) from public.orby_intelligence_jobs where status='dead'),'open_insights',(select count(*) from public.orby_proactive_insights where status='open')),
  'workflows',jsonb_build_object('definitions',(select count(*) from public.orby_workflow_definitions),'active',(select count(*) from public.orby_workflow_definitions where status='active'),'templates',(select count(*) from public.orby_workflow_templates where enabled),'running',(select count(*) from public.orby_workflow_runs where status in ('pending','running','waiting','retry'))),
  'plugins',jsonb_build_object('catalog',(select count(*) from public.orby_plugins),'active',(select count(*) from public.orby_plugins where status='active'),'installations',(select count(*) from public.orby_plugin_installations where status='active')),
  'governance',jsonb_build_object('policies',(select count(*) from public.orby_governance_policies where enabled),'immutable',(select count(*) from public.orby_governance_policies where immutable and enabled),'pending_data_requests',(select count(*) from public.orby_data_governance_requests where status='pending')),
  'observability',jsonb_build_object('traces_24h',(select count(*) from public.orby_traces where started_at>=now()-interval '24 hours'),'failed_24h',(select count(*) from public.orby_traces where status='failed' and started_at>=now()-interval '24 hours'),'cost_30d',(select coalesce(sum(amount),0) from public.orby_cost_events where occurred_at>=now()-interval '30 days')),
  'evaluation',jsonb_build_object('suites',(select count(*) from public.orby_evaluation_suites where enabled),'last_run',(select jsonb_build_object('status',status,'score',score,'started_at',started_at) from public.orby_evaluation_runs order by started_at desc limit 1)),
  'channels',jsonb_build_object('active',(select count(*) from public.orby_channels where status='active'),'external_active',(select count(*) from public.orby_channels where key<>'in_app' and status='active')),
  'generated_at',now()
 ) else private.raise_forbidden() end
$$;

revoke all on function public.orby_os_publish_workflow_version(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.orby_os_publish_prompt_version(text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.orby_os_set_provider_state(text,boolean,integer) from public,anon,authenticated;
revoke all on function public.orby_os_restore_backup(uuid,boolean) from public,anon,authenticated;
revoke all on function public.orby_os_self_test() from public,anon,authenticated;
revoke all on function public.orby_os_admin_dashboard() from public,anon,authenticated;
grant execute on function public.orby_os_publish_workflow_version(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) to authenticated,service_role;
grant execute on function public.orby_os_publish_prompt_version(text,text,text,text,uuid) to authenticated,service_role;
grant execute on function public.orby_os_set_provider_state(text,boolean,integer) to authenticated,service_role;
grant execute on function public.orby_os_restore_backup(uuid,boolean) to authenticated,service_role;
grant execute on function public.orby_os_self_test() to authenticated,service_role;
grant execute on function public.orby_os_admin_dashboard() to authenticated,service_role;
