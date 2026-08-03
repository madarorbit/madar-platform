-- MADAR V2.0 final production security hardening.
-- Administrative ORBY OS operations are server-only. The member runtime
-- resolver remains available because it applies organization membership checks
-- and returns only the safe resolved runtime configuration.

revoke all on function public.orby_os_activate_external_runtime(text,text,text) from public,anon,authenticated;
revoke all on function public.orby_os_admin_dashboard() from public,anon,authenticated;
revoke all on function public.orby_os_create_backup(uuid,text) from public,anon,authenticated;
revoke all on function public.orby_os_deactivate_external_runtime() from public,anon,authenticated;
revoke all on function public.orby_os_promote_release(uuid,integer) from public,anon,authenticated;
revoke all on function public.orby_os_publish_prompt_version(text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.orby_os_publish_workflow_version(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.orby_os_restore_backup(uuid,boolean) from public,anon,authenticated;
revoke all on function public.orby_os_rollback_release(uuid) from public,anon,authenticated;
revoke all on function public.orby_os_self_test() from public,anon,authenticated;
revoke all on function public.orby_os_set_feature_flag(text,boolean,integer,jsonb,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.orby_os_set_plugin_state(uuid,text) from public,anon,authenticated;
revoke all on function public.orby_os_set_policy_state(uuid,boolean) from public,anon,authenticated;
revoke all on function public.orby_os_set_provider_state(text,boolean,integer) from public,anon,authenticated;

grant execute on function public.orby_os_activate_external_runtime(text,text,text) to service_role;
grant execute on function public.orby_os_admin_dashboard() to service_role;
grant execute on function public.orby_os_create_backup(uuid,text) to service_role;
grant execute on function public.orby_os_deactivate_external_runtime() to service_role;
grant execute on function public.orby_os_promote_release(uuid,integer) to service_role;
grant execute on function public.orby_os_publish_prompt_version(text,text,text,text,uuid) to service_role;
grant execute on function public.orby_os_publish_workflow_version(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.orby_os_restore_backup(uuid,boolean) to service_role;
grant execute on function public.orby_os_rollback_release(uuid) to service_role;
grant execute on function public.orby_os_self_test() to service_role;
grant execute on function public.orby_os_set_feature_flag(text,boolean,integer,jsonb,uuid,uuid,uuid,text) to service_role;
grant execute on function public.orby_os_set_plugin_state(uuid,text) to service_role;
grant execute on function public.orby_os_set_policy_state(uuid,boolean) to service_role;
grant execute on function public.orby_os_set_provider_state(text,boolean,integer) to service_role;

-- Explicit service policies document that these tables are intentionally
-- invisible to browser roles while remaining available to background workers.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'integration_connection_secrets',
    'integration_idempotency_keys',
    'integration_readiness_checks',
    'integration_readiness_runs',
    'v2_transition_membership_backups',
    'v2_transition_subscription_backups'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_service_only',table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      table_name||'_service_only',table_name
    );
    execute format('revoke all on public.%I from public,anon,authenticated',table_name);
  end loop;
end $$;

insert into public.audit_logs(actor_id,action,entity_type,metadata)
values(
  null,
  'v2.production.security_hardened',
  'platform',
  jsonb_build_object(
    'orbyAdminRpcs','service_role_only',
    'runtimeResolver','authenticated_membership_checked',
    'serviceTables','explicit_service_policies',
    'releaseTransportExtensionRemoved',true
  )
);

-- The http extension was enabled only to fetch SHA-pinned release artifacts
-- during this controlled deployment. Runtime code does not depend on it.
drop extension if exists http;
