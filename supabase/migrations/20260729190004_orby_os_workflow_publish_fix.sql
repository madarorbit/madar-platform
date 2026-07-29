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
declare resolved_workflow_id uuid;version_id uuid;next_version integer;checksum_value text;
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
 returning id into resolved_workflow_id;
 select coalesce(max(v.version),0)+1 into next_version from public.orby_workflow_versions v where v.workflow_id=resolved_workflow_id;
 checksum_value:=encode(extensions.digest(target_definition::text,'sha256'),'hex');
 if target_status='active' then update public.orby_workflow_versions set status='paused' where workflow_id=resolved_workflow_id and status='active'; end if;
 insert into public.orby_workflow_versions(workflow_id,version,definition,input_schema,output_schema,checksum,max_duration_seconds,status,created_by)
 values(resolved_workflow_id,next_version,target_definition,coalesce(target_input_schema,'{}'::jsonb),coalesce(target_output_schema,'{}'::jsonb),checksum_value,3600,target_status,auth.uid()) returning id into version_id;
 return jsonb_build_object('workflow_id',resolved_workflow_id,'version_id',version_id,'version',next_version,'checksum',checksum_value,'status',target_status);
end $$;
revoke all on function public.orby_os_publish_workflow_version(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.orby_os_publish_workflow_version(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) to authenticated,service_role;
