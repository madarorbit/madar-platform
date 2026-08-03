import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const path='supabase/migrations/20260804123000_madar_v2_production_security_hardening.sql';

test('ORBY OS administrative SECURITY DEFINER functions are server-only',async()=>{
 const sql=await readFile(path,'utf8');
 for(const fn of [
  'orby_os_activate_external_runtime','orby_os_admin_dashboard','orby_os_create_backup',
  'orby_os_deactivate_external_runtime','orby_os_promote_release','orby_os_publish_prompt_version',
  'orby_os_publish_workflow_version','orby_os_restore_backup','orby_os_rollback_release',
  'orby_os_self_test','orby_os_set_feature_flag','orby_os_set_plugin_state',
  'orby_os_set_policy_state','orby_os_set_provider_state',
 ]){
  assert.match(sql,new RegExp(`revoke all on function public\\.${fn}\\(`));
  assert.match(sql,new RegExp(`grant execute on function public\\.${fn}\\(`));
 }
 assert.doesNotMatch(sql,/revoke all on function public\.orby_resolve_runtime_config/);
});

test('service-only tables have explicit policies and temporary release transport is removed',async()=>{
 const sql=await readFile(path,'utf8');
 for(const table of [
  'integration_connection_secrets','integration_idempotency_keys','integration_readiness_checks',
  'integration_readiness_runs','v2_transition_membership_backups','v2_transition_subscription_backups',
 ])assert.match(sql,new RegExp(`'${table}'`));
 assert.match(sql,/for all to service_role using \(true\) with check \(true\)/);
 assert.match(sql,/revoke all on public\.%I from public,anon,authenticated/);
 assert.match(sql,/drop extension if exists http/);
 assert.match(sql,/v2\.production\.security_hardened/);
});
