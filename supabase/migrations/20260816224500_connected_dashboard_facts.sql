-- Phase 6.0 — Connected Business Dashboard & Overview
-- Surgical read-only boundary for exact latest-per-connection health/run semantics
-- and exact open-incident counts. The function is SECURITY INVOKER so existing
-- RLS remains the authorization boundary for the authenticated caller.

create or replace function public.connected_dashboard_facts(target_organization uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $function$
with scoped_connections as (
  select
    c.id,
    c.name,
    c.connector_key,
    c.status as connection_status,
    c.connection_mode,
    c.last_success_at,
    c.last_error_message,
    c.created_at
  from public.integration_connections c
  where c.organization_id = target_organization
    and c.deleted_at is null
), per_connection as (
  select
    c.id as connection_id,
    c.name,
    c.connector_key,
    c.connection_status,
    c.connection_mode,
    c.last_success_at,
    c.last_error_message,
    c.created_at,
    (
      select jsonb_build_object(
        'id', h.id,
        'connection_id', h.connection_id,
        'status', h.status,
        'freshness_seconds', h.freshness_seconds,
        'success_rate', h.success_rate,
        'quality_score', h.quality_score,
        'queue_depth', h.queue_depth,
        'open_issues', h.open_issues,
        'captured_at', h.captured_at
      )
      from public.integration_health_snapshots h
      where h.organization_id = target_organization
        and h.connection_id = c.id
      order by h.captured_at desc, h.id desc
      limit 1
    ) as latest_health,
    (
      select jsonb_build_object(
        'id', r.id,
        'connection_id', r.connection_id,
        'sync_mode', r.sync_mode,
        'status', r.status,
        'records_received', r.records_received,
        'error_message', r.error_message,
        'started_at', r.started_at,
        'finished_at', r.finished_at
      )
      from public.integration_sync_runs r
      where r.organization_id = target_organization
        and r.connection_id = c.id
      order by r.started_at desc, r.id desc
      limit 1
    ) as latest_run,
    (
      select count(*)::integer
      from public.integration_health_incidents i
      where i.organization_id = target_organization
        and i.connection_id = c.id
        and i.status <> 'resolved'
    ) as open_incident_count,
    exists (
      select 1
      from public.integration_health_incidents i
      where i.organization_id = target_organization
        and i.connection_id = c.id
        and i.status <> 'resolved'
        and i.severity = 'critical'
    ) as has_critical_incident,
    exists (
      select 1
      from public.integration_health_incidents i
      where i.organization_id = target_organization
        and i.connection_id = c.id
        and i.status <> 'resolved'
        and i.severity = 'error'
    ) as has_error_incident,
    exists (
      select 1
      from public.integration_health_incidents i
      where i.organization_id = target_organization
        and i.connection_id = c.id
        and i.status <> 'resolved'
        and i.severity = 'warning'
    ) as has_warning_incident
  from scoped_connections c
), summary as (
  select
    count(*)::integer as connection_count,
    coalesce(sum(open_incident_count), 0)::integer as open_incident_count,
    count(*) filter (where has_critical_incident)::integer as sources_with_critical_incident,
    count(*) filter (where has_error_incident)::integer as sources_with_error_incident,
    count(*) filter (where has_warning_incident)::integer as sources_with_warning_incident,
    max(last_success_at) as latest_success_at
  from per_connection
)
select jsonb_build_object(
  'sources', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'connection_id', p.connection_id,
          'name', p.name,
          'connector_key', p.connector_key,
          'connection_status', p.connection_status,
          'connection_mode', p.connection_mode,
          'last_success_at', p.last_success_at,
          'last_error_message', p.last_error_message,
          'created_at', p.created_at,
          'latest_health', p.latest_health,
          'latest_run', p.latest_run,
          'open_incident_count', p.open_incident_count,
          'has_critical_incident', p.has_critical_incident,
          'has_error_incident', p.has_error_incident,
          'has_warning_incident', p.has_warning_incident
        )
        order by p.created_at desc, p.connection_id
      )
      from per_connection p
    ),
    '[]'::jsonb
  ),
  'summary', (
    select jsonb_build_object(
      'connection_count', s.connection_count,
      'open_incident_count', s.open_incident_count,
      'sources_with_critical_incident', s.sources_with_critical_incident,
      'sources_with_error_incident', s.sources_with_error_incident,
      'sources_with_warning_incident', s.sources_with_warning_incident,
      'latest_success_at', s.latest_success_at
    )
    from summary s
  )
);
$function$;

revoke all on function public.connected_dashboard_facts(uuid) from public;
grant execute on function public.connected_dashboard_facts(uuid) to authenticated, service_role;
