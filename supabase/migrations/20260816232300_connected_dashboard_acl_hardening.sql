-- Phase 6.0 Security Closure Patch
-- Explicitly close inherited/default execution paths for the Connected dashboard
-- read-only RPC while preserving authenticated runtime and service-role access.

revoke execute on function public.connected_dashboard_facts(uuid) from anon;
revoke execute on function public.connected_dashboard_facts(uuid) from public;

grant execute on function public.connected_dashboard_facts(uuid) to authenticated, service_role;
