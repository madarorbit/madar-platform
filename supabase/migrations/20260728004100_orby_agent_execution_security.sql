-- ORBY Stage 2 security and browser access policies.
-- Configuration: members may read; OWNER/ADMIN and platform SUPER_ADMIN may manage.
drop policy if exists orby_execution_config_manage on public.orby_execution_config;
drop policy if exists orby_execution_config_select on public.orby_execution_config;
drop policy if exists orby_execution_config_insert on public.orby_execution_config;
drop policy if exists orby_execution_config_update on public.orby_execution_config;
drop policy if exists orby_execution_config_delete on public.orby_execution_config;
create policy orby_execution_config_select on public.orby_execution_config for select to authenticated using (
 (organization_id is not null and exists(select 1 from public.organization_members m where m.organization_id=orby_execution_config.organization_id and m.user_id=(select auth.uid())))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);
create policy orby_execution_config_insert on public.orby_execution_config for insert to authenticated with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
 or (organization_id is not null and exists(select 1 from public.organization_members m where m.organization_id=orby_execution_config.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN')))
);
create policy orby_execution_config_update on public.orby_execution_config for update to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
 or (organization_id is not null and exists(select 1 from public.organization_members m where m.organization_id=orby_execution_config.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN')))
) with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
 or (organization_id is not null and exists(select 1 from public.organization_members m where m.organization_id=orby_execution_config.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN')))
);
create policy orby_execution_config_delete on public.orby_execution_config for delete to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
 or (organization_id is not null and exists(select 1 from public.organization_members m where m.organization_id=orby_execution_config.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN')))
);

-- Catalog contains metadata only, never executable code. Enabled tools are discoverable by authenticated users.
drop policy if exists orby_tool_catalog_manage on public.orby_tool_catalog;
drop policy if exists orby_tool_catalog_select on public.orby_tool_catalog;
drop policy if exists orby_tool_catalog_insert on public.orby_tool_catalog;
drop policy if exists orby_tool_catalog_update on public.orby_tool_catalog;
drop policy if exists orby_tool_catalog_delete on public.orby_tool_catalog;
create policy orby_tool_catalog_select on public.orby_tool_catalog for select to authenticated using (
 (enabled and status='active') or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('SUPER_ADMIN','ADMIN'))
);
create policy orby_tool_catalog_insert on public.orby_tool_catalog for insert to authenticated with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('SUPER_ADMIN','ADMIN'))
);
create policy orby_tool_catalog_update on public.orby_tool_catalog for update to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('SUPER_ADMIN','ADMIN'))
) with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('SUPER_ADMIN','ADMIN'))
);
create policy orby_tool_catalog_delete on public.orby_tool_catalog for delete to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('SUPER_ADMIN','ADMIN'))
);

-- Execution records are visible only to the run owner, organization OWNER/ADMIN, or platform SUPER_ADMIN.
drop policy if exists orby_workflows_select on public.orby_workflows;
create policy orby_workflows_select on public.orby_workflows for select to authenticated using (
 created_by=(select auth.uid())
 or exists(select 1 from public.organization_members m where m.organization_id=orby_workflows.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);
drop policy if exists orby_workflow_runs_select on public.orby_workflow_runs;
create policy orby_workflow_runs_select on public.orby_workflow_runs for select to authenticated using (
 user_id=(select auth.uid())
 or exists(select 1 from public.organization_members m where m.organization_id=orby_workflow_runs.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);
drop policy if exists orby_actions_select on public.orby_actions;
create policy orby_actions_select on public.orby_actions for select to authenticated using (
 user_id=(select auth.uid())
 or exists(select 1 from public.organization_members m where m.organization_id=orby_actions.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);
drop policy if exists orby_approvals_select on public.orby_approvals;
create policy orby_approvals_select on public.orby_approvals for select to authenticated using (
 requested_by=(select auth.uid())
 or exists(select 1 from public.organization_members m where m.organization_id=orby_approvals.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);
drop policy if exists orby_execution_events_select on public.orby_execution_events;
create policy orby_execution_events_select on public.orby_execution_events for select to authenticated using (
 exists(select 1 from public.orby_workflow_runs r where r.id=orby_execution_events.run_id and (r.user_id=(select auth.uid()) or exists(select 1 from public.organization_members m where m.organization_id=r.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);
drop policy if exists orby_execution_audit_select on public.orby_execution_audit;
create policy orby_execution_audit_select on public.orby_execution_audit for select to authenticated using (
 exists(select 1 from public.orby_workflow_runs r where r.id=orby_execution_audit.run_id and (r.user_id=(select auth.uid()) or exists(select 1 from public.organization_members m where m.organization_id=r.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);
drop policy if exists orby_sandbox_runs_select on public.orby_sandbox_runs;
create policy orby_sandbox_runs_select on public.orby_sandbox_runs for select to authenticated using (
 user_id=(select auth.uid())
 or exists(select 1 from public.organization_members m where m.organization_id=orby_sandbox_runs.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);

-- Queue and usage are service-role only by design; browser roles have no policies or grants.
drop policy if exists orby_execution_queue_service on public.orby_execution_queue;
create policy orby_execution_queue_service on public.orby_execution_queue for all to service_role using (true) with check (true);
drop policy if exists orby_execution_usage_service on public.orby_execution_usage;
create policy orby_execution_usage_service on public.orby_execution_usage for all to service_role using (true) with check (true);
revoke all privileges on table public.orby_execution_config,public.orby_tool_catalog,public.orby_workflows,public.orby_workflow_runs,public.orby_actions,public.orby_approvals,public.orby_execution_queue,public.orby_execution_events,public.orby_execution_audit,public.orby_sandbox_runs,public.orby_execution_usage from anon,authenticated;
grant select,insert,update,delete on table public.orby_execution_config,public.orby_tool_catalog to authenticated;
grant select on table public.orby_workflows,public.orby_workflow_runs,public.orby_actions,public.orby_approvals,public.orby_execution_events,public.orby_execution_audit,public.orby_sandbox_runs to authenticated;
grant select,insert,update,delete on table public.orby_execution_config,public.orby_tool_catalog,public.orby_workflows,public.orby_workflow_runs,public.orby_actions,public.orby_approvals,public.orby_execution_queue,public.orby_execution_events,public.orby_execution_audit,public.orby_sandbox_runs,public.orby_execution_usage to service_role;
