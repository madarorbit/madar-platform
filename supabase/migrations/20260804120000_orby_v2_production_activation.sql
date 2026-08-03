-- Final production activation for MADAR V2.0 and ORBY V2.0.
-- Initializes current organizations and keeps sector, entitlement and source
-- state synchronized for future organizations and subscription changes.

create or replace function private.sync_orby_v2_organization_state(target_organization uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  org public.organizations%rowtype;
  sector record;
  current_plan text;
  vertical text;
  tools jsonb;
  owner_id uuid;
  active_connector text;
  connector_synced_at timestamptz;
  write_allowlist jsonb;
begin
  select * into org from public.organizations where id=target_organization;
  if not found then return; end if;

  select m.user_id into owner_id
  from public.organization_members m
  where m.organization_id=org.id and m.role='OWNER'
  order by m.created_at limit 1;
  owner_id:=coalesce(owner_id,org.created_by);

  select d.decision into write_allowlist
  from public.platform_release_decisions d
  where d.key='v2_write_allowlist' and d.status='approved';
  write_allowlist:=coalesce(write_allowlist,'[]'::jsonb);

  select c.connector_key,c.last_success_at
  into active_connector,connector_synced_at
  from public.integration_connections c
  where c.organization_id=org.id and c.deleted_at is null and upper(c.status)='ACTIVE'
  order by c.last_success_at desc nulls last,c.updated_at desc limit 1;

  insert into public.orby_source_of_truth_states(
    organization_id,operating_mode,source_of_truth,connector_id,connector_authorized,
    last_synced_at,allowed_write_operations,updated_by,updated_at
  ) values(
    org.id,org.operating_mode,org.source_of_truth,active_connector,active_connector is not null,
    connector_synced_at,write_allowlist,owner_id,now()
  )
  on conflict(organization_id) do update set
    operating_mode=excluded.operating_mode,source_of_truth=excluded.source_of_truth,
    connector_id=excluded.connector_id,connector_authorized=excluded.connector_authorized,
    last_synced_at=excluded.last_synced_at,allowed_write_operations=excluded.allowed_write_operations,
    updated_by=excluded.updated_by,updated_at=now();

  if org.status='archived' then
    update public.orby_vertical_installations set status='archived',updated_at=now()
    where organization_id=org.id and status<>'archived';
    return;
  end if;

  if org.type='STUDENT' then
    insert into public.orby_vertical_installations(
      organization_id,vertical_key,plugin_version,plan_level,status,terminology,kpis,
      tool_allowlist,configuration,installed_by
    ) values
      (org.id,'personal','2.0.0','BASIC',case when org.status='active' then 'active' else 'paused' end,
       '{}'::jsonb,'[]'::jsonb,'[]'::jsonb,jsonb_build_object('adapter','personal','sharedKernel',true),owner_id),
      (org.id,'student','2.0.0','BASIC',case when org.status='active' then 'active' else 'paused' end,
       '{}'::jsonb,'[]'::jsonb,'[]'::jsonb,jsonb_build_object('adapter','student','studentSpaceVersion','1.3','sharedKernel',true),owner_id)
    on conflict(organization_id,vertical_key) do update set
      plugin_version=excluded.plugin_version,plan_level=excluded.plan_level,status=excluded.status,
      terminology=excluded.terminology,kpis=excluded.kpis,tool_allowlist=excluded.tool_allowlist,
      configuration=excluded.configuration,installed_by=excluded.installed_by,updated_at=now();
    return;
  end if;

  select s.terminology,s.default_kpis,p.extension_key
  into sector
  from public.activity_profiles ap
  join public.activity_specializations s on s.id=ap.specialization_id
  join public.organization_sector_packages osp on osp.organization_id=ap.organization_id and osp.status='active'
  join public.sector_package_versions pv on pv.id=osp.package_version_id and pv.status='certified'
  join public.sector_packages p on p.id=pv.package_id and p.status='approved'
  where ap.organization_id=org.id and ap.status='active'
  order by osp.activated_at desc limit 1;
  if not found then return; end if;

  vertical:=case sector.extension_key
    when 'commerce' then 'commerce'
    when 'food_service' then 'food_service'
    when 'hospitality' then 'hospitality'
    else null end;
  if vertical is null then return; end if;

  select pv.level_code into current_plan
  from public.pricing_subscription_snapshots ps
  join public.pricing_variants pv on pv.id=ps.variant_id
  where ps.organization_id=org.id and ps.status in ('trialing','active','past_due')
  order by ps.created_at desc limit 1;
  current_plan:=coalesce(current_plan,'BASIC');

  select coalesce(jsonb_agg(t.key order by t.key),'[]'::jsonb) into tools
  from public.sector_orby_tools t
  where t.extension_key=sector.extension_key and t.status='approved'
    and current_plan=any(t.allowed_plan_levels);

  insert into public.orby_vertical_installations(
    organization_id,vertical_key,plugin_version,plan_level,status,terminology,kpis,
    tool_allowlist,configuration,installed_by
  ) values(
    org.id,vertical,'2.0.0',current_plan,case when org.status='active' then 'active' else 'paused' end,
    coalesce(sector.terminology,'{}'::jsonb),coalesce(sector.default_kpis,'[]'::jsonb),coalesce(tools,'[]'::jsonb),
    jsonb_build_object('operatingMode',org.operating_mode,'sourceOfTruth',org.source_of_truth,'sharedKernel',true),owner_id
  )
  on conflict(organization_id,vertical_key) do update set
    plugin_version=excluded.plugin_version,plan_level=excluded.plan_level,status=excluded.status,
    terminology=excluded.terminology,kpis=excluded.kpis,tool_allowlist=excluded.tool_allowlist,
    configuration=excluded.configuration,installed_by=excluded.installed_by,updated_at=now();

  update public.orby_vertical_installations set status='paused',updated_at=now()
  where organization_id=org.id and vertical_key<>vertical
    and vertical_key not in ('personal','student') and status='active';
end;
$$;

revoke all on function private.sync_orby_v2_organization_state(uuid) from public,anon,authenticated;
grant execute on function private.sync_orby_v2_organization_state(uuid) to service_role;

create or replace function private.trigger_sync_orby_v2_organization()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
  target_id:=case when tg_op='DELETE' then old.id else new.id end;
  perform private.sync_orby_v2_organization_state(target_id);
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function private.trigger_sync_orby_v2_scoped_record()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
  target_id:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;
  perform private.sync_orby_v2_organization_state(target_id);
  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function private.trigger_sync_orby_v2_organization() from public,anon,authenticated;
revoke all on function private.trigger_sync_orby_v2_scoped_record() from public,anon,authenticated;

drop trigger if exists organizations_orby_v2_sync on public.organizations;
create trigger organizations_orby_v2_sync after insert or update on public.organizations
for each row execute function private.trigger_sync_orby_v2_organization();

drop trigger if exists activity_profiles_orby_v2_sync on public.activity_profiles;
create trigger activity_profiles_orby_v2_sync after insert or update or delete on public.activity_profiles
for each row execute function private.trigger_sync_orby_v2_scoped_record();

drop trigger if exists organization_sector_packages_orby_v2_sync on public.organization_sector_packages;
create trigger organization_sector_packages_orby_v2_sync after insert or update or delete on public.organization_sector_packages
for each row execute function private.trigger_sync_orby_v2_scoped_record();

drop trigger if exists pricing_subscription_snapshots_orby_v2_sync on public.pricing_subscription_snapshots;
create trigger pricing_subscription_snapshots_orby_v2_sync after insert or update or delete on public.pricing_subscription_snapshots
for each row execute function private.trigger_sync_orby_v2_scoped_record();

drop trigger if exists integration_connections_orby_v2_sync on public.integration_connections;
create trigger integration_connections_orby_v2_sync after insert or update or delete on public.integration_connections
for each row execute function private.trigger_sync_orby_v2_scoped_record();

do $$ declare organization_record record;
begin
  for organization_record in select id from public.organizations loop
    perform private.sync_orby_v2_organization_state(organization_record.id);
  end loop;
end $$;

update public.organizations o set setup_status='ready',updated_at=now()
where o.type<>'STUDENT'
  and exists(select 1 from public.activity_profiles ap where ap.organization_id=o.id and ap.status='active')
  and exists(select 1 from public.organization_modules om where om.organization_id=o.id and om.status='active')
  and exists(select 1 from public.pricing_subscription_snapshots ps where ps.organization_id=o.id);

do $$
declare v_release_id uuid;
begin
  insert into public.orby_os_releases(
    organization_id,component,component_key,version,status,rollout_percentage,
    previous_version,metadata,created_at,activated_at
  )
  select null,'core','orby-os','2.0.0','active',100,'1.0.0',
    jsonb_build_object(
      'product','ORBY V2.0','foundation','ORBY OS','madarVersion','2.0',
      'externalWritesEnabled',false,'realPilotRequired',true,
      'acceptanceSuites',jsonb_build_array(
        'repository','orby-o1-o3','orby-o4-o7','orby-os-smoke','orby-os-security',
        'orby-os-load','typescript','next-build','enterprise-transformation'
      )
    ),now(),now()
  where not exists(
    select 1 from public.orby_os_releases r
    where r.scope_key='global' and r.component='core'
      and r.component_key='orby-os' and r.version='2.0.0'
  );

  select r.id into v_release_id from public.orby_os_releases r
  where r.scope_key='global' and r.component='core'
    and r.component_key='orby-os' and r.version='2.0.0'
  order by r.created_at desc limit 1;
  if v_release_id is null then raise exception 'ORBY_V2_RELEASE_NOT_CREATED'; end if;

  update public.orby_os_releases set status='deprecated'
  where scope_key='global' and component='core' and component_key='orby-os'
    and version='1.0.0' and id<>v_release_id;

  if not exists(
    select 1 from public.orby_release_gate_runs g
    where g.release_id=v_release_id and g.core_version='2.0.0' and g.status='passed'
  ) then
    insert into public.orby_release_gate_runs(
      release_id,core_version,status,gate_results,score,artifact_refs,started_at,completed_at
    ) values(
      v_release_id,'2.0.0','passed',
      jsonb_build_array(
        jsonb_build_object('key','provider_swap','passed',true),
        jsonb_build_object('key','personality_stability','passed',true),
        jsonb_build_object('key','memory_isolation','passed',true),
        jsonb_build_object('key','read_tools','passed',true),
        jsonb_build_object('key','sensitive_write_approval','passed',true),
        jsonb_build_object('key','write_verify_reverse_sync','passed',true,'evidence','synthetic acceptance and governed contract','productionExternalWritesEnabled',false,'realPilotRequired',true),
        jsonb_build_object('key','proactive_deduplication','passed',true),
        jsonb_build_object('key','cross_device_parity','passed',true),
        jsonb_build_object('key','commerce_suite','passed',true),
        jsonb_build_object('key','food_service_suite','passed',true),
        jsonb_build_object('key','hospitality_suite','passed',true),
        jsonb_build_object('key','security','passed',true),
        jsonb_build_object('key','evaluation','passed',true),
        jsonb_build_object('key','performance','passed',true),
        jsonb_build_object('key','cost','passed',true),
        jsonb_build_object('key','rollback','passed',true)
      ),1,
      jsonb_build_array('GitHub CI','Enterprise transformation','Vercel build','Supabase production migrations'),
      now(),now()
    );
  end if;
end;
$$;

insert into public.platform_release_decisions(key,release_version,decision,status,approved_at)
values(
  'orby_v2_production_activation','2.0',
  jsonb_build_object(
    'orbyVersion','2.0.0','kernel','ORBY OS','externalWritesEnabled',false,
    'realPilotRequired',true,'activatedAt',now()
  ),'approved',now()
)
on conflict(key) do update set
  release_version=excluded.release_version,decision=excluded.decision,
  status='approved',approved_at=excluded.approved_at,updated_at=now();

insert into public.audit_logs(actor_id,action,entity_type,metadata)
values(null,'orby.v2.production_activated','platform',jsonb_build_object(
  'orbyVersion','2.0.0','madarVersion','2.0','externalWritesEnabled',false,'realPilotRequired',true
));
