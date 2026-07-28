import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../supabase/migrations/20260729001400_orby_memory_knowledge_proactive_hardening.sql',import.meta.url),'utf8');

test('Stage 3 service role is constrained to CRUD privileges',()=>{
 assert.match(migration,/revoke all privileges[\s\S]*from service_role/i);
 assert.match(migration,/grant select,insert,update,delete[\s\S]*to service_role/i);
 assert.doesNotMatch(migration,/grant[\s\S]{0,80}\b(truncate|trigger|references)\b[\s\S]{0,80}service_role/i);
});

test('Stage 3 foreign keys have explicit covering indexes',()=>{
 assert.match(migration,/orby_memory_policies_created_by_idx/);
 assert.match(migration,/orby_memory_policies_updated_by_idx/);
 assert.match(migration,/orby_proactive_notifications_org_idx/);
});
