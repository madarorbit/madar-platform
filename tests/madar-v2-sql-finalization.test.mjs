import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationPath='supabase/migrations/20260805070700_madar_v2_sql_contract_finalization.sql';

test('final V2 SQL contract keeps mutating entitlement resolution volatile',async()=>{
 const migration=await readFile(migrationPath,'utf8');
 assert.match(migration,/current_v2_entitlement[\s\S]*language plpgsql[\s\S]*volatile[\s\S]*security definer/i);
 assert.match(migration,/v2_active_subscription_entitlement/);
});

test('all restrictive V2 policy tables have RLS enabled',async()=>{
 const migration=await readFile(migrationPath,'utf8');
 assert.match(migration,/pg_catalog\.pg_policies/);
 assert.match(migration,/madar v2 workspace access gate/);
 assert.match(migration,/madar v2 orby access gate/);
 assert.match(migration,/alter table public\.%I enable row level security/);
});

test('public V2 payment RPC rejects missing or unsupported currency',async()=>{
 const migration=await readFile(migrationPath,'utf8');
 assert.match(migration,/upper\(coalesce\(target_currency, ''\)\) not in \('SAR', 'USD', 'YER'\)/);
 assert.match(migration,/INVALID_PAYMENT_CURRENCY/);
 assert.match(migration,/private\.submit_v2_local_payment_impl/);
});
