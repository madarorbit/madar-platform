import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(path,'utf8');

test('commercial access uses the authoritative V2 server-time resolver',async()=>{
 const business=await read('src/lib/business.ts');
 assert.match(business,/resolve_pricing_subscription_status/);
 assert.doesNotMatch(business,/refresh_workspace_subscription/);
 assert.match(business,/allowMissing/);
 assert.match(business,/allowCancelled/);
 assert.match(business,/تعذر التحقق من حالة اشتراك مَدار V2\.0/);
});

test('subscription recovery stays reachable for every locked state',async()=>{
 const page=await read('app/account/subscription/page.tsx');
 const actions=await read('app/actions/local-payments.ts');
 assert.match(page,/allowExpired:\s*true/);
 assert.match(page,/allowMissing:\s*true/);
 assert.match(page,/allowCancelled:\s*true/);
 assert.match(page,/currency=eq\.\$\{currency\}/);
 assert.match(actions,/submitV2LocalPayment/);
 assert.match(actions,/allowExpired:true,allowMissing:true,allowCancelled:true/);
 assert.doesNotMatch(actions,/submitSubscriptionRenewal[\s\S]*submit_subscription_renewal/);
});

test('PostgreSQL persists expiry using server time and least privilege',async()=>{
 const migration=await read('supabase/migrations/20260805070100_madar_v2_subscription_access_hardening.sql');
 assert.match(migration,/security definer/i);
 assert.match(migration,/set search_path\s*=\s*''/i);
 assert.match(migration,/trial_ends_at\s*<=\s*now\(\)/i);
 assert.match(migration,/ends_at\s*<=\s*now\(\)/i);
 assert.match(migration,/set status = 'expired'/i);
 assert.match(migration,/revoke all on function public\.resolve_pricing_subscription_status/i);
 assert.match(migration,/grant execute[\s\S]*authenticated, service_role/i);
 assert.doesNotMatch(migration,/workspace_subscriptions|subscription_plans/);
});

test('V1 financial records are archival and cannot be approved from the admin UI',async()=>{
 const admin=await read('app/admin/local-payments/page.tsx');
 assert.match(admin,/أرشيف V1 للقراءة فقط/);
 assert.doesNotMatch(admin,/reviewSubscriptionRenewal/);
 assert.match(admin,/reviewV2LocalPayment/);
 assert.doesNotMatch(admin,/eslint-disable @typescript-eslint\/no-explicit-any/);
});
