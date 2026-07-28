import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../supabase/migrations/20260728003000_orby_add_foreign_key_indexes.sql',import.meta.url);

test('ORBY foreign keys have explicit covering indexes',async()=>{
 const sql=await readFile(migrationUrl,'utf8');
 for(const index of [
  'orby_runtime_config_organization_idx',
  'orby_runtime_config_created_by_idx',
  'orby_runtime_config_updated_by_idx',
  'orby_sessions_user_idx',
  'orby_model_registry_created_by_idx',
  'orby_model_registry_updated_by_idx',
 ])assert.match(sql,new RegExp(`create index if not exists ${index}\\b`,'i'));
});
