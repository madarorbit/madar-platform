import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const compatibility='supabase/migrations/20260804105900_orby_v2_o4_o7_compatibility.sql';
const completion='supabase/migrations/20260804110000_orby_v2_o4_o7_completion.sql';

test('ORBY O4-O7 compatibility runs before completion and preserves legacy governance data',async()=>{
 const files=(await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(files.indexOf('20260804105900_orby_v2_o4_o7_compatibility.sql')<files.indexOf('20260804110000_orby_v2_o4_o7_completion.sql'));
 const sql=await readFile(compatibility,'utf8');
 for(const column of ['scope','decision_reason','decided_by','created_at'])assert.match(sql,new RegExp(`add column if not exists ${column}`));
 assert.match(sql,/created_at=coalesce\(created_at,requested_at,now\(\)\)/);
 assert.match(sql,/references public\.integration_connectors\(connector_key\)/);
 assert.match(sql,/ORBY_SOURCE_CONNECTOR_TYPE_REQUIRES_MANUAL_REVIEW/);
});

test('ORBY O4-O7 completion uses the real connector key and idempotent policies',async()=>{
 const sql=await readFile(completion,'utf8');
 assert.match(sql,/connector_id text references public\.integration_connectors\(connector_key\)/);
 assert.doesNotMatch(sql,/integration_connectors\(id\)/);
 for(const name of ['orby_vertical_installations_members_read','orby_cross_device_owner_rw','orby_data_governance_owner_create','orby_channel_registry_service']){
  assert.match(sql,new RegExp(`drop policy if exists ${name} on public\\.`));
  assert.match(sql,new RegExp(`create policy ${name} on public\\.`));
 }
});
