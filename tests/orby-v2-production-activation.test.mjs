import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const path='supabase/migrations/20260804120000_orby_v2_production_activation.sql';

test('ORBY V2 production activation initializes workspaces and the production transition detaches Student',async()=>{
 const [sql,transition]=await Promise.all([readFile(path,'utf8'),readFile('supabase/migrations/20260811190000_account_services_production.sql','utf8')]);
 assert.match(sql,/private\.sync_orby_v2_organization_state/);
 for(const table of ['organizations','activity_profiles','organization_sector_packages','pricing_subscription_snapshots','integration_connections']){
  assert.match(sql,new RegExp(`create trigger ${table}_orby_v2_sync`));
 }
 assert.match(sql,/tg_op='DELETE'/);
 assert.match(sql,/orby_source_of_truth_states/);
 assert.match(sql,/orby_vertical_installations/);
 assert.match(sql,/vertical_key,plugin_version,plan_level/);
 assert.match(sql,/'personal','2\.0\.0','BASIC'/);
 assert.match(sql,/current_plan=any\(t\.allowed_plan_levels\)/);
 assert.match(transition,/orby_domain_plugins[\s\S]*domain_key = 'student'/);
 assert.match(transition,/orby_vertical_installations[\s\S]*vertical_key = 'student'/);
});

test('ORBY V2 activation records governed release and keeps external writes closed',async()=>{
 const sql=await readFile(path,'utf8');
 assert.match(sql,/'orby-os','2\.0\.0','active',100,'1\.0\.0'/);
 assert.match(sql,/g\.release_id=v_release_id/);
 assert.match(sql,/productionExternalWritesEnabled',false/);
 assert.match(sql,/realPilotRequired',true/);
 for(const gate of ['provider_swap','personality_stability','memory_isolation','sensitive_write_approval','write_verify_reverse_sync','cross_device_parity','commerce_suite','food_service_suite','hospitality_suite','security','evaluation','performance','cost','rollback']){
  assert.match(sql,new RegExp(`'${gate}'`));
 }
 assert.match(sql,/orby\.v2\.production_activated/);
});
