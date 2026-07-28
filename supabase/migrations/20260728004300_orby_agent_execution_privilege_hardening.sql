-- Restrict ORBY Stage 2 service-role table privileges to required CRUD only.
-- Supabase default table privileges may otherwise include TRUNCATE, TRIGGER and REFERENCES.

revoke all privileges on table
 public.orby_execution_config,
 public.orby_tool_catalog,
 public.orby_workflows,
 public.orby_workflow_runs,
 public.orby_actions,
 public.orby_approvals,
 public.orby_execution_queue,
 public.orby_execution_events,
 public.orby_execution_audit,
 public.orby_sandbox_runs,
 public.orby_execution_usage
from service_role;

grant select,insert,update,delete on table
 public.orby_execution_config,
 public.orby_tool_catalog,
 public.orby_workflows,
 public.orby_workflow_runs,
 public.orby_actions,
 public.orby_approvals,
 public.orby_execution_queue,
 public.orby_execution_events,
 public.orby_execution_audit,
 public.orby_sandbox_runs,
 public.orby_execution_usage
to service_role;
