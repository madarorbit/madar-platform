import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../supabase/migrations/20260728004500_orby_approvals_action_fk_index.sql',import.meta.url);

test('ORBY approval action foreign key has a full-state covering index',async()=>{
 const sql=await readFile(migrationUrl,'utf8');
 assert.match(sql,/create index if not exists orby_approvals_action_idx[\s\S]*on public\.orby_approvals\(action_id\)/i);
 assert.match(sql,/where action_id is not null/i);
});
