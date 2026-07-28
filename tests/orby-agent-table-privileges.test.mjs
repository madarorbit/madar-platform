import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../supabase/migrations/20260728004300_orby_agent_execution_privilege_hardening.sql',import.meta.url);

test('ORBY Stage 2 service role is limited to required CRUD privileges',async()=>{
 const sql=await readFile(migrationUrl,'utf8');
 assert.match(sql,/revoke all privileges[\s\S]*from service_role/i);
 assert.match(sql,/grant select,insert,update,delete[\s\S]*to service_role/i);
 assert.doesNotMatch(sql,/grant[\s\S]*\btruncate\b/i);
 assert.doesNotMatch(sql,/grant[\s\S]*\btrigger\b/i);
 assert.doesNotMatch(sql,/grant[\s\S]*\breferences\b/i);
});
