import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../supabase/migrations/20260728002000_orby_restrict_authenticated_table_privileges.sql',import.meta.url);

test('ORBY authenticated role is limited to required CRUD privileges',async()=>{
 const sql=await readFile(migrationUrl,'utf8');
 assert.match(sql,/revoke all privileges[\s\S]*from authenticated/i);
 assert.match(sql,/revoke all privileges[\s\S]*from anon/i);
 assert.match(sql,/grant select,insert,update,delete[\s\S]*to authenticated/i);
 assert.doesNotMatch(sql,/grant[\s\S]*\btruncate\b/i);
 assert.doesNotMatch(sql,/grant[\s\S]*\btrigger\b/i);
 assert.doesNotMatch(sql,/grant[\s\S]*\breferences\b/i);
});
