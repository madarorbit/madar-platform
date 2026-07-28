import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../supabase/migrations/20260728004400_orby_agent_execution_fk_indexes.sql',import.meta.url);

test('ORBY Stage 2 execution usage user foreign key is indexed',async()=>{
 const sql=await readFile(migrationUrl,'utf8');
 assert.match(sql,/create index if not exists orby_execution_usage_user_idx[\s\S]*\(user_id,bucket_start desc\)/i);
});
