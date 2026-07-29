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
  'release',(select coalesce(jsonb_agg(to_jsonb(r)-'scope_key'),'[]'::jsonb) from public.orby_os_releases r where r.organization_id is not distinct from target_organization),
  'feature_flags',(select coalesce(jsonb_agg(to_jsonb(f)-'scope_key'),'[]'::jsonb) from public.orby_feature_flags f where f.organization_id is not distinct from target_organization),
  'workflow_definitions',(select coalesce(jsonb_agg(to_jsonb(d)-'scope_key'),'[]'::jsonb) from public.orby_workflow_definitions d where d.organization_id is not distinct from target_organization),
  'workflow_versions',(select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) from public.orby_workflow_versions v join public.orby_workflow_definitions d on d.id=v.workflow_id where d.organization_id is not distinct from target_organization),
  'workflow_templates',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.orby_workflow_templates t join public.orby_workflow_versions v on v.id=t.workflow_version_id join public.orby_workflow_definitions d on d.id=v.workflow_id where d.organization_id is not distinct from target_organization),
  'plugins',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.orby_plugins p),
  'plugin_versions',(select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) from public.orby_plugin_versions v),
  'domain_plugins',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from public.orby_domain_plugins d),
  'plugin_installations',(select coalesce(jsonb_agg(to_jsonb(i)-'scope_key'),'[]'::jsonb) from public.orby_plugin_installations i where i.organization_id is not distinct from target_organization),
  'prompt_versions',(select coalesce(jsonb_agg(to_jsonb(p)-'scope_key'),'[]'::jsonb) from public.orby_prompt_versions p where p.organization_id is not distinct from target_organization),
  'governance_policies',(select coalesce(jsonb_agg(to_jsonb(p)-'scope_key'),'[]'::jsonb) from public.orby_governance_policies p where p.organization_id is not distinct from target_organization),
  'provider_registry',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.orby_provider_registry p),
  'model_registry',(select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from public.orby_model_registry m),
  'budgets',(select coalesce(jsonb_agg(to_jsonb(b)-'scope_key'),'[]'::jsonb) from public.orby_budgets b where b.organization_id is not distinct from target_organization),
  'channels',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.orby_channels c),
  'channel_bindings',(select coalesce(jsonb_agg(to_jsonb(c)-'workspace_scope'),'[]'::jsonb) from public.orby_channel_bindings c where c.organization_id=target_organization),
  'created_at',now(),'schema_version','orby-os-v1'
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
declare record public.orby_backups;computed text;sections jsonb;item jsonb;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 select * into record from public.orby_backups where id=target_backup for update;
 if record.id is null or record.status not in ('ready','restored') then raise exception 'Backup unavailable' using errcode='P0002'; end if;
 computed:=encode(extensions.digest(record.snapshot::text,'sha256'),'hex');if computed<>record.checksum then raise exception 'Backup checksum mismatch' using errcode='P0001'; end if;
 select coalesce(jsonb_agg(key),'[]'::jsonb) into sections from jsonb_object_keys(record.snapshot) as key;
 if dry_run then return jsonb_build_object('valid',true,'dry_run',true,'backup_id',record.id,'organization_id',record.organization_id,'sections',sections,'schema_version',record.snapshot->>'schema_version'); end if;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'workflow_definitions','[]')) loop
  insert into public.orby_workflow_definitions(id,organization_id,key,name,description,domain,status,required_permissions,tags,metadata,created_by,created_at,updated_at)
  values((item->>'id')::uuid,nullif(item->>'organization_id','')::uuid,item->>'key',item->>'name',item->>'description',item->>'domain',item->>'status',coalesce(item->'required_permissions','[]'),coalesce(item->'tags','[]'),coalesce(item->'metadata','{}'),nullif(item->>'created_by','')::uuid,coalesce((item->>'created_at')::timestamptz,now()),now())
  on conflict(id) do update set name=excluded.name,description=excluded.description,domain=excluded.domain,status=excluded.status,required_permissions=excluded.required_permissions,tags=excluded.tags,metadata=excluded.metadata,updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'workflow_versions','[]')) loop
  insert into public.orby_workflow_versions(id,workflow_id,version,definition,input_schema,output_schema,checksum,max_duration_seconds,status,created_by,created_at)
  values((item->>'id')::uuid,(item->>'workflow_id')::uuid,(item->>'version')::integer,item->'definition',coalesce(item->'input_schema','{}'),coalesce(item->'output_schema','{}'),item->>'checksum',(item->>'max_duration_seconds')::integer,item->>'status',nullif(item->>'created_by','')::uuid,coalesce((item->>'created_at')::timestamptz,now()))
  on conflict(id) do update set definition=excluded.definition,input_schema=excluded.input_schema,output_schema=excluded.output_schema,checksum=excluded.checksum,max_duration_seconds=excluded.max_duration_seconds,status=excluded.status;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'workflow_templates','[]')) loop
  insert into public.orby_workflow_templates(id,key,workflow_version_id,name,description,domain,enabled,metadata,created_at,updated_at)
  values((item->>'id')::uuid,item->>'key',(item->>'workflow_version_id')::uuid,item->>'name',item->>'description',item->>'domain',(item->>'enabled')::boolean,coalesce(item->'metadata','{}'),coalesce((item->>'created_at')::timestamptz,now()),now())
  on conflict(id) do update set workflow_version_id=excluded.workflow_version_id,name=excluded.name,description=excluded.description,domain=excluded.domain,enabled=excluded.enabled,metadata=excluded.metadata,updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'plugins','[]')) loop
  insert into public.orby_plugins(id,key,name,description,kind,entrypoint,isolation,status,metadata,created_at,updated_at)
  values((item->>'id')::uuid,item->>'key',item->>'name',item->>'description',item->>'kind',item->>'entrypoint',item->>'isolation',item->>'status',coalesce(item->'metadata','{}'),coalesce((item->>'created_at')::timestamptz,now()),now())
  on conflict(id) do update set name=excluded.name,description=excluded.description,kind=excluded.kind,entrypoint=excluded.entrypoint,isolation=excluded.isolation,status=excluded.status,metadata=excluded.metadata,updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'plugin_versions','[]')) loop
  insert into public.orby_plugin_versions(id,plugin_id,version,compatible_core,manifest,checksum,status,created_at)
  values((item->>'id')::uuid,(item->>'plugin_id')::uuid,item->>'version',item->>'compatible_core',item->'manifest',item->>'checksum',item->>'status',coalesce((item->>'created_at')::timestamptz,now()))
  on conflict(id) do update set compatible_core=excluded.compatible_core,manifest=excluded.manifest,checksum=excluded.checksum,status=excluded.status;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'domain_plugins','[]')) loop
  insert into public.orby_domain_plugins(id,domain_key,plugin_id,permissions,tools,workflows,knowledge_namespaces,policy_keys,enabled,updated_at)
  values((item->>'id')::uuid,item->>'domain_key',(item->>'plugin_id')::uuid,coalesce(item->'permissions','[]'),coalesce(item->'tools','[]'),coalesce(item->'workflows','[]'),coalesce(item->'knowledge_namespaces','[]'),coalesce(item->'policy_keys','[]'),(item->>'enabled')::boolean,now())
  on conflict(id) do update set plugin_id=excluded.plugin_id,permissions=excluded.permissions,tools=excluded.tools,workflows=excluded.workflows,knowledge_namespaces=excluded.knowledge_namespaces,policy_keys=excluded.policy_keys,enabled=excluded.enabled,updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'prompt_versions','[]')) loop
  insert into public.orby_prompt_versions(id,organization_id,domain,key,version,content,checksum,status,evaluation_run_id,created_by,created_at)
  values((item->>'id')::uuid,nullif(item->>'organization_id','')::uuid,item->>'domain',item->>'key',(item->>'version')::integer,item->>'content',item->>'checksum',item->>'status',nullif(item->>'evaluation_run_id','')::uuid,nullif(item->>'created_by','')::uuid,coalesce((item->>'created_at')::timestamptz,now()))
  on conflict(id) do update set content=excluded.content,checksum=excluded.checksum,status=excluded.status,evaluation_run_id=excluded.evaluation_run_id;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'feature_flags','[]')) loop
  insert into public.orby_feature_flags(key,organization_id,workspace_id,user_id,environment,enabled,rollout_percentage,starts_at,ends_at,configuration,updated_by)
  values(item->>'key',nullif(item->>'organization_id','')::uuid,nullif(item->>'workspace_id','')::uuid,nullif(item->>'user_id','')::uuid,nullif(item->>'environment',''),case when item->>'key' in ('orby_provider_execution_enabled','orby_ocr_enabled','orby_external_channels_enabled') then false else coalesce((item->>'enabled')::boolean,false) end,case when item->>'key' in ('orby_provider_execution_enabled','orby_ocr_enabled','orby_external_channels_enabled') then 0 else coalesce((item->>'rollout_percentage')::integer,0) end,nullif(item->>'starts_at','')::timestamptz,nullif(item->>'ends_at','')::timestamptz,coalesce(item->'configuration','{}'),auth.uid())
  on conflict(key,scope_key) do update set enabled=excluded.enabled,rollout_percentage=excluded.rollout_percentage,starts_at=excluded.starts_at,ends_at=excluded.ends_at,configuration=excluded.configuration,updated_by=auth.uid(),updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'governance_policies','[]')) loop
  insert into public.orby_governance_policies(key,organization_id,workspace_id,name,description,priority,enabled,immutable,effect,approval_scope,conditions,limits,metadata,updated_by)
  values(item->>'key',nullif(item->>'organization_id','')::uuid,nullif(item->>'workspace_id','')::uuid,item->>'name',item->>'description',(item->>'priority')::integer,case when coalesce((item->>'immutable')::boolean,false) then true else coalesce((item->>'enabled')::boolean,true) end,coalesce((item->>'immutable')::boolean,false),item->>'effect',nullif(item->>'approval_scope',''),coalesce(item->'conditions','{}'),coalesce(item->'limits','{}'),coalesce(item->'metadata','{}'),auth.uid())
  on conflict(key,scope_key) do update set name=excluded.name,description=excluded.description,priority=excluded.priority,enabled=excluded.enabled,immutable=excluded.immutable,effect=excluded.effect,approval_scope=excluded.approval_scope,conditions=excluded.conditions,limits=excluded.limits,metadata=excluded.metadata,updated_by=auth.uid(),updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'provider_registry','[]')) loop
  insert into public.orby_provider_registry(id,display_name,enabled,priority,capabilities,limits,routing_policy,metadata,created_by,updated_by)
  values(item->>'id',item->>'display_name',false,(item->>'priority')::integer,coalesce(item->'capabilities','{}'),coalesce(item->'limits','{}'),coalesce(item->'routing_policy','{}'),coalesce(item->'metadata','{}'),nullif(item->>'created_by','')::uuid,auth.uid())
  on conflict(id) do update set display_name=excluded.display_name,enabled=false,priority=excluded.priority,capabilities=excluded.capabilities,limits=excluded.limits,routing_policy=excluded.routing_policy,metadata=excluded.metadata,updated_by=auth.uid(),updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'model_registry','[]')) loop
  insert into public.orby_model_registry(id,provider_id,provider_model,display_name,enabled,priority,capabilities,limits,pricing,metadata)
  values(item->>'id',item->>'provider_id',item->>'provider_model',item->>'display_name',false,(item->>'priority')::integer,coalesce(item->'capabilities','{}'),coalesce(item->'limits','{}'),coalesce(item->'pricing','{}'),coalesce(item->'metadata','{}'))
  on conflict(id) do update set provider_id=excluded.provider_id,provider_model=excluded.provider_model,display_name=excluded.display_name,enabled=false,priority=excluded.priority,capabilities=excluded.capabilities,limits=excluded.limits,pricing=excluded.pricing,metadata=excluded.metadata,updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'plugin_installations','[]')) loop
  insert into public.orby_plugin_installations(plugin_version_id,organization_id,workspace_id,status,configuration,installed_by)
  values((item->>'plugin_version_id')::uuid,nullif(item->>'organization_id','')::uuid,nullif(item->>'workspace_id','')::uuid,item->>'status',coalesce(item->'configuration','{}'),nullif(item->>'installed_by','')::uuid)
  on conflict(plugin_version_id,scope_key) do update set status=excluded.status,configuration=excluded.configuration,installed_by=excluded.installed_by,updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'budgets','[]')) loop
  insert into public.orby_budgets(organization_id,workspace_id,user_id,period,limit_amount,currency,warning_percentage,hard_stop,enabled,updated_by)
  values(nullif(item->>'organization_id','')::uuid,nullif(item->>'workspace_id','')::uuid,nullif(item->>'user_id','')::uuid,item->>'period',(item->>'limit_amount')::numeric,item->>'currency',(item->>'warning_percentage')::integer,(item->>'hard_stop')::boolean,(item->>'enabled')::boolean,auth.uid())
  on conflict(scope_key,period,currency) do update set limit_amount=excluded.limit_amount,warning_percentage=excluded.warning_percentage,hard_stop=excluded.hard_stop,enabled=excluded.enabled,updated_by=auth.uid(),updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(coalesce(record.snapshot->'channel_bindings','[]')) loop
  insert into public.orby_channel_bindings(channel_id,organization_id,workspace_id,enabled,configuration,created_by)
  values((item->>'channel_id')::uuid,(item->>'organization_id')::uuid,nullif(item->>'workspace_id','')::uuid,false,coalesce(item->'configuration','{}'),auth.uid())
  on conflict(channel_id,organization_id,workspace_scope) do update set enabled=false,configuration=excluded.configuration,updated_at=now();
 end loop;
 update public.orby_backups set status='restored',restored_at=now() where id=record.id;
 return jsonb_build_object('valid',true,'dry_run',false,'backup_id',record.id,'status','restored','sections',sections,'deferred_integrations_forced_disabled',true);
end $$;

create or replace function public.orby_os_promote_release(target_release uuid,target_rollout integer default 100)
returns public.orby_os_releases
language plpgsql
security definer
set search_path=''
as $$
declare result public.orby_os_releases;latest_evaluation public.orby_evaluation_runs;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if target_rollout<1 or target_rollout>100 then raise exception 'Invalid rollout percentage' using errcode='22023'; end if;
 select * into result from public.orby_os_releases where id=target_release for update;if result.id is null then raise exception 'Release not found' using errcode='P0002'; end if;
 select * into latest_evaluation from public.orby_evaluation_runs order by started_at desc limit 1;
 if result.component='core' and (latest_evaluation.id is null or latest_evaluation.status<>'passed') then raise exception 'A passing ORBY OS benchmark is required before core promotion' using errcode='P0001'; end if;
 update public.orby_os_releases set status='paused' where component=result.component and component_key=result.component_key and scope_key=result.scope_key and status in ('active','canary') and id<>result.id;
 update public.orby_os_releases set status=case when target_rollout<100 then 'canary' else 'active' end,rollout_percentage=target_rollout,activated_at=now() where id=result.id returning * into result;return result;
end $$;

create or replace function public.orby_os_rollback_release(target_release uuid)
returns public.orby_os_releases
language plpgsql
security definer
set search_path=''
as $$
declare current_release public.orby_os_releases;result public.orby_os_releases;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 select * into current_release from public.orby_os_releases where id=target_release for update;
 if current_release.id is null or current_release.previous_version is null then raise exception 'Rollback target unavailable' using errcode='P0002'; end if;
 update public.orby_os_releases set status='archived',rollout_percentage=0 where id=current_release.id;
 select * into result from public.orby_os_releases where component=current_release.component and component_key=current_release.component_key and version=current_release.previous_version and scope_key=current_release.scope_key order by created_at desc limit 1;
 if result.id is null then
  insert into public.orby_os_releases(organization_id,component,component_key,version,status,rollout_percentage,previous_version,metadata,created_by,activated_at)
  values(current_release.organization_id,current_release.component,current_release.component_key,current_release.previous_version,'active',100,current_release.version,jsonb_build_object('rollbackOf',current_release.id),auth.uid(),now()) returning * into result;
 else update public.orby_os_releases set status='active',rollout_percentage=100,activated_at=now() where id=result.id returning * into result;end if;
 return result;
end $$;

revoke all on function public.orby_os_create_backup(uuid,text) from public,anon,authenticated;
revoke all on function public.orby_os_restore_backup(uuid,boolean) from public,anon,authenticated;
revoke all on function public.orby_os_promote_release(uuid,integer) from public,anon,authenticated;
revoke all on function public.orby_os_rollback_release(uuid) from public,anon,authenticated;
grant execute on function public.orby_os_create_backup(uuid,text) to authenticated,service_role;
grant execute on function public.orby_os_restore_backup(uuid,boolean) to authenticated,service_role;
grant execute on function public.orby_os_promote_release(uuid,integer) to authenticated,service_role;
grant execute on function public.orby_os_rollback_release(uuid) to authenticated,service_role;
