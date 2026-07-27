begin;

alter function public.integration_quality_dashboard() security invoker;

revoke all on function public.integration_admin_set_feature_flag(text,boolean,uuid) from authenticated;
revoke all on function public.integration_admin_set_connection_state(uuid,text) from authenticated;
revoke all on function public.integration_admin_enqueue_sync(uuid,text) from authenticated;
revoke all on function public.integration_admin_backfill_raw_batches(integer) from authenticated;
revoke all on function public.integration_admin_resolve_quality_issue(uuid,text,text) from authenticated;

grant execute on function public.integration_admin_set_feature_flag(text,boolean,uuid) to service_role;
grant execute on function public.integration_admin_set_connection_state(uuid,text) to service_role;
grant execute on function public.integration_admin_enqueue_sync(uuid,text) to service_role;
grant execute on function public.integration_admin_backfill_raw_batches(integer) to service_role;
grant execute on function public.integration_admin_resolve_quality_issue(uuid,text,text) to service_role;
grant execute on function public.integration_quality_dashboard() to authenticated,service_role;

create index if not exists integration_audit_actor_idx on public.integration_audit_events(actor_id) where actor_id is not null;

create index if not exists integration_mapping_organization_idx on public.integration_mapping_rules(organization_id) where organization_id is not null;
create index if not exists integration_mapping_created_by_idx on public.integration_mapping_rules(created_by) where created_by is not null;
create index if not exists integration_mapping_updated_by_idx on public.integration_mapping_rules(updated_by) where updated_by is not null;

create index if not exists integration_match_candidate_idx on public.integration_match_candidates(candidate_record_id);
create index if not exists integration_match_reviewed_by_idx on public.integration_match_candidates(reviewed_by) where reviewed_by is not null;

create index if not exists integration_pipeline_records_connection_idx on public.integration_pipeline_records(connection_id,created_at desc);
create index if not exists integration_pipeline_records_duplicate_idx on public.integration_pipeline_records(duplicate_of) where duplicate_of is not null;

create index if not exists integration_quality_pipeline_record_idx on public.integration_quality_issues(pipeline_record_id) where pipeline_record_id is not null;
create index if not exists integration_quality_pipeline_run_idx on public.integration_quality_issues(pipeline_run_id) where pipeline_run_id is not null;
create index if not exists integration_quality_raw_batch_idx on public.integration_quality_issues(raw_batch_id) where raw_batch_id is not null;
create index if not exists integration_quality_resolved_by_idx on public.integration_quality_issues(resolved_by) where resolved_by is not null;

create index if not exists integration_relations_to_record_idx on public.integration_udm_relations(to_record_id) where to_record_id is not null;

create index if not exists integration_source_keys_connection_idx on public.integration_udm_source_keys(connection_id,last_seen_at desc);
create index if not exists integration_source_keys_raw_batch_idx on public.integration_udm_source_keys(raw_batch_id) where raw_batch_id is not null;

create index if not exists integration_validation_created_by_idx on public.integration_validation_rules(created_by) where created_by is not null;
create index if not exists integration_validation_updated_by_idx on public.integration_validation_rules(updated_by) where updated_by is not null;

notify pgrst,'reload schema';
commit;
