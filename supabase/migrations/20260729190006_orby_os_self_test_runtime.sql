create or replace function public.orby_os_self_test()
returns jsonb
language sql
security definer
set search_path=''
as $$
 select case when private.is_admin() then jsonb_build_object(
  'stage4_tables',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('orby_os_releases','orby_feature_flags','orby_workflow_definitions','orby_workflow_versions','orby_workflow_templates','orby_plugins','orby_plugin_versions','orby_plugin_installations','orby_domain_plugins','orby_prompt_versions','orby_governance_policies','orby_traces','orby_trace_spans','orby_cost_events','orby_budgets','orby_evaluation_suites','orby_evaluation_cases','orby_evaluation_runs','orby_evaluation_results','orby_backups','orby_channels','orby_channel_bindings','orby_data_governance_requests','orby_provider_circuits','orby_provider_registry')),
  'workflow_templates',(select count(*) from public.orby_workflow_templates where enabled),
  'domain_plugins',(select count(*) from public.orby_domain_plugins where enabled),
  'immutable_policies',(select count(*) from public.orby_governance_policies where enabled and immutable),
  'deferred_gates_closed',(select count(*)=3 from public.orby_feature_flags where key in ('orby_provider_execution_enabled','orby_ocr_enabled','orby_external_channels_enabled') and not enabled and rollout_percentage=0),
  'external_channels_active',(select count(*) from public.orby_channels where key<>'in_app' and status='active'),
  'enabled_models',(select count(*) from public.orby_model_registry where enabled),
  'enabled_providers',(select count(*) from public.orby_provider_registry where enabled),
  'enabled_schedules',(select count(*) from public.orby_intelligence_schedules where enabled),
  'queued_intelligence_jobs',(select count(*) from public.orby_intelligence_jobs where status in ('queued','retry')),
  'memory_isolation_policy',(select count(*)>0 from pg_catalog.pg_policies where schemaname='public' and tablename='orby_memories' and policyname='orby_memories_user_select'),
  'notification_isolation_policy',(select count(*)>0 from pg_catalog.pg_policies where schemaname='public' and tablename='orby_proactive_notifications' and policyname='orby_proactive_notifications_user_select'),
  'generated_at',now()
 ) else private.raise_forbidden() end
$$;
revoke all on function public.orby_os_self_test() from public,anon,authenticated;
grant execute on function public.orby_os_self_test() to authenticated,service_role;
