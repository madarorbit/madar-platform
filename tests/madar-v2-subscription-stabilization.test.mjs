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
 assert.doesNotMatch(actions,/submitSubscriptionRenewal|reviewSubscriptionRenewal/);
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
 const actions=await read('app/actions/local-payments.ts');
 assert.match(admin,/أرشيف V1 للقراءة فقط/);
 assert.doesNotMatch(admin,/reviewSubscriptionRenewal/);
 assert.match(admin,/reviewV2LocalPayment/);
 assert.doesNotMatch(actions,/submitSubscriptionRenewal|reviewSubscriptionRenewal/);
 assert.doesNotMatch(admin,/eslint-disable @typescript-eslint\/no-explicit-any/);
});

test('V2 entitlements replace executable V1 limits and quota',async()=>{
 const migration=await read('supabase/migrations/20260805070300_madar_v2_entitlement_enforcement.sql');
 assert.match(migration,/v2_active_subscription_entitlement/);
 assert.match(migration,/locked_entitlements/);
 assert.match(migration,/revoke execute on function public\.submit_subscription_renewal/);
 assert.match(migration,/revoke execute on function public\.review_subscription_renewal/);
 assert.match(migration,/revoke execute on function public\.refresh_workspace_subscription/);
 assert.match(migration,/MADAR_V2_LOCKED_ENTITLEMENTS/);
 assert.doesNotMatch(migration,/workspace_subscriptions|subscription_plans/);
});

test('operational RPCs require server-valid workspace access while billing remains recoverable',async()=>{
 const migration=await read('supabase/migrations/20260805070400_madar_v2_rpc_access_gate.sql');
 assert.match(migration,/assert_v2_organization_membership/);
 assert.match(migration,/assert_v2_organization_access/);
 assert.match(migration,/v2_active_subscription_entitlement\([\s\S]*'workspace_access'/);
 assert.match(migration,/submit_v2_local_payment_impl[\s\S]*assert_v2_organization_membership/);
 assert.doesNotMatch(migration,/submit_v2_local_payment_impl[\s\S]*actor := private\.assert_v2_organization_access/);
 assert.match(migration,/WORKSPACE_CURRENCY_MISMATCH/);
 assert.match(migration,/is_grandfathered[\s\S]*false/);
 assert.match(migration,/pricing\.v2_payment\.approved/);
});

test('founder controls and overview use V2 subscriptions exclusively',async()=>{
 const actions=await read('app/actions/founder.ts');
 const workspaces=await read('app/admin/founder/workspaces/page.tsx');
 const center=await read('app/admin/founder/page.tsx');
 const migration=await read('supabase/migrations/20260805070200_madar_v2_founder_subscription_control.sql');
 assert.match(actions,/founder_adjust_v2_subscription/);
 assert.doesNotMatch(actions,/founder_adjust_subscription/);
 assert.match(workspaces,/pricing_current_subscriptions/);
 assert.doesNotMatch(workspaces,/workspace_subscriptions|subscription_plans/);
 assert.match(center,/subscriptions\.pending_payments/);
 assert.doesNotMatch(center,/pending_renewals/);
 assert.match(migration,/revoke execute on function public\.founder_adjust_subscription/);
 assert.match(migration,/founder\.v2_subscription\.adjusted/);
 assert.match(migration,/ACTIVE_SUBSCRIPTION_REQUIRES_FUTURE_END/);
});

test('founder notifications accept internal routes only',async()=>{
 const actions=await read('app/actions/founder.ts');
 assert.match(actions,/!link\.startsWith\('\/'\)\|\|link\.startsWith\('\/\/'\)/);
 assert.match(actions,/رابط الإشعار يجب أن يكون مسارًا داخليًا آمنًا/);
});
