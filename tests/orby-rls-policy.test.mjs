import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../supabase/migrations/20260728001000_orby_core_foundation.sql',import.meta.url);

test('ORBY RLS keeps runtime access tenant-safe without blocking enabled models',async()=>{
 const sql=await readFile(migrationUrl,'utf8');
 assert.match(sql,/alter table public\.orby_runtime_config enable row level security/i);
 assert.match(sql,/alter table public\.orby_sessions enable row level security/i);
 assert.match(sql,/create policy orby_model_registry_select[\s\S]*?enabled or exists/i);
 assert.match(sql,/create policy orby_runtime_config_select[\s\S]*?organization_members/i);
 assert.match(sql,/m\.user_id=\(select auth\.uid\(\)\)/i);
 assert.match(sql,/create policy orby_model_registry_update[\s\S]*?with check/i);
 assert.doesNotMatch(sql,/create policy orby_runtime_config_manage/i);
 assert.doesNotMatch(sql,/create policy orby_model_registry_admin/i);
 assert.doesNotMatch(sql,/api_key|access_token|provider_secret/i);
});
