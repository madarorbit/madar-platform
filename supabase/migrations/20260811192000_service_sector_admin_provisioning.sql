-- Central service approval provisions a sector package on behalf of the new
-- workspace owner. Preserve the direct-member guard, and add one narrow admin
-- path that proves the delegated actor both created and owns the workspace.

create or replace function private.activate_sector_package_impl(
  target_organization uuid,
  target_specialization uuid,
  actor uuid
)
returns public.activity_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  spec public.activity_specializations;
  typ public.activity_types;
  fam public.activity_families;
  org public.organizations;
  profile public.activity_profiles;
  extension text;
  caller uuid := (select auth.uid());
begin
  if caller is not null then
    if actor = caller then
      perform private.assert_v2_organization_access(target_organization, true);
    elsif (select private.is_admin()) then
      if not exists (
        select 1
        from public.organizations o
        join public.organization_members m
          on m.organization_id = o.id
         and m.user_id = actor
         and m.role = 'OWNER'
        where o.id = target_organization
          and o.created_by = actor
      ) then
        raise exception 'DELEGATED_OWNER_CONTEXT_REQUIRED';
      end if;
    else
      raise exception 'ACTOR_MISMATCH';
    end if;
  end if;

  select * into org
  from public.organizations
  where id = target_organization
  for update;
  if org.id is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  select * into spec
  from public.activity_specializations
  where id = target_specialization
    and status = 'approved'
    and is_visible
    and launch_enabled;
  if spec.id is null then raise exception 'VERTICAL_NOT_APPROVED'; end if;

  select * into typ
  from public.activity_types
  where id = spec.activity_type_id and status = 'approved' and is_visible;
  select * into fam
  from public.activity_families
  where id = typ.family_id and status = 'approved' and is_visible;
  if typ.id is null or fam.id is null then
    raise exception 'VERTICAL_TAXONOMY_NOT_APPROVED';
  end if;
  if exists (
    select 1
    from public.activity_specialization_packages sp
    where sp.specialization_id = spec.id
      and sp.is_required
      and not exists (
        select 1 from public.sector_package_versions pv
        where pv.package_id = sp.package_id and pv.status = 'certified'
      )
  ) then raise exception 'SECTOR_PACKAGE_NOT_CERTIFIED'; end if;

  insert into public.activity_profiles(
    organization_id, family_id, activity_type_id, specialization_id,
    operating_mode, configuration, status, created_by
  ) values (
    org.id, fam.id, typ.id, spec.id, org.operating_mode, '{}', 'active', actor
  )
  on conflict(organization_id) do update set
    family_id = excluded.family_id,
    activity_type_id = excluded.activity_type_id,
    specialization_id = excluded.specialization_id,
    operating_mode = excluded.operating_mode,
    status = 'active',
    updated_at = now()
  returning * into profile;

  delete from public.organization_sector_packages where organization_id = org.id;
  insert into public.organization_sector_packages(
    organization_id, package_version_id, status, activated_by
  )
  select org.id, pv.id, 'active', actor
  from public.activity_specialization_packages sp
  join lateral (
    select id
    from public.sector_package_versions
    where package_id = sp.package_id and status = 'certified'
    order by certified_at desc nulls last, version desc
    limit 1
  ) pv on true
  where sp.specialization_id = spec.id;

  delete from public.organization_modules where organization_id = org.id;
  insert into public.organization_modules(
    organization_id, module_key, status, source_of_truth, configuration
  )
  select distinct
    org.id,
    b.module_key,
    'active',
    case when org.operating_mode = 'CONNECTED_EXTERNAL' then 'EXTERNAL'
      else m.source_of_truth end,
    b.configuration
  from public.organization_sector_packages osp
  join public.sector_package_versions pv on pv.id = osp.package_version_id
  join public.sector_module_bindings b on b.package_id = pv.package_id
  join public.native_module_definitions m on m.key = b.module_key
  where osp.organization_id = org.id
    and osp.status = 'active'
    and m.status = 'approved'
  on conflict(organization_id, module_key) do update set
    status = 'active',
    source_of_truth = excluded.source_of_truth,
    configuration = excluded.configuration;

  select p.extension_key into extension
  from public.activity_specialization_packages asp
  join public.sector_packages p on p.id = asp.package_id
  where asp.specialization_id = spec.id
  order by asp.is_required desc
  limit 1;

  insert into public.sector_dashboard_configs(
    organization_id, extension_key, widgets, terminology
  ) values (
    org.id,
    extension,
    case extension
      when 'commerce' then '["revenue","gross_profit","inventory_turnover","low_stock"]'::jsonb
      when 'food_service' then '["daily_revenue","food_cost_ratio","open_tickets","ticket_time"]'::jsonb
      else '["occupancy","adr","revpar","arrivals_departures"]'::jsonb
    end,
    spec.terminology
  )
  on conflict(organization_id) do update set
    extension_key = excluded.extension_key,
    widgets = excluded.widgets,
    terminology = excluded.terminology,
    updated_at = now();

  delete from public.sector_report_configs where organization_id = org.id;
  insert into public.sector_report_configs(
    organization_id, key, name_ar, extension_key, definition
  )
  select
    org.id,
    k.key,
    k.name_ar,
    k.extension_key,
    jsonb_build_object('kpi', k.key, 'formula', k.formula, 'unit', k.unit)
  from public.sector_kpi_definitions k
  where k.extension_key = extension and k.status = 'approved';

  update public.organizations
  set setup_status = 'in_progress',
      sector_package_version = '2.0.0',
      source_of_truth = case when operating_mode = 'CONNECTED_EXTERNAL'
        then 'EXTERNAL' else 'MADAR' end
  where id = org.id;

  return profile;
end
$$;

revoke all on function private.activate_sector_package_impl(uuid, uuid, uuid)
from public, anon;
grant execute on function private.activate_sector_package_impl(uuid, uuid, uuid)
to authenticated, service_role;
