import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('unified ORBY keeps one core and account-level quota tiers',async()=>{
 const[stream,chat,accountRuntime,migration]=await Promise.all([read('app/api/orby/stream/route.ts'),read('components/orby/OrbyChat.tsx'),read('src/lib/orby/account-runtime.ts'),read('supabase/migrations/20260812230015_orby_unified_account_plus.sql')]);
 assert.match(stream,/consume_orby_account_quota/);assert.match(stream,/reserve_orby_guest_request/);assert.match(stream,/createAccountOrbyFoundation/);assert.match(stream,/createServerOrbyFoundation/);assert.match(stream,/OrbyDialogueManager/);assert.match(stream,/MADAR_RETAIL/);assert.match(stream,/retail_analytics_snapshot|retailEvidence/);
 assert.doesNotMatch(stream,/body\.mode/);assert.doesNotMatch(chat,/setMode|modeButtons|اختر.*تحليل/i);assert.match(chat,/\/api\/orby\/stream/);assert.match(chat,/AbortController/);assert.match(chat,/function stop/);assert.match(chat,/function retry/);
 assert.match(accountRuntime,/createOrbyFoundation/);assert.match(accountRuntime,/providersFromEnvironment/);assert.match(accountRuntime,/loadSupabaseOrbyModels/);
 for(const pattern of [/daily_limit',20/,/daily_limit',5/,/tier','plus'/,/used<30/,/used<1000/,/orby_guest_usage_daily/,/primary key\(user_id,usage_date\)/])assert.match(migration,pattern);
});

test('service launch is exact and uses supplied service artwork',async()=>{
 const[catalog,launch,account]=await Promise.all([read('src/lib/services/catalog.ts'),read('app/account/services/[code]/open/route.ts'),read('app/account/page.tsx')]);
 for(const asset of ['connect-existing.webp','build-on-madar.webp','madar-retail.webp'])assert.match(catalog,new RegExp(asset.replace('.','\\.')));
 for(const route of ['/workspace/connect','/workspace','/retail/workspace'])assert.ok(catalog.includes(route));
 for(const service of ['CONNECT_EXISTING','BUILD_ON_MADAR','MADAR_RETAIL'])assert.ok(catalog.includes(`/account/services/${service}/open`));
 assert.match(launch,/service_code=eq/);assert.match(launch,/activation_state=eq\.ACTIVE/);assert.match(launch,/default_commercial_organization_id/);assert.match(account,/coverImage/);
});

test('Retail and workspace ORBY converge on unified account chat',async()=>{
 const[retail,workspace,dashboard]=await Promise.all([read('app/retail/workspace/orby/page.tsx'),read('app/workspace/orby/page.tsx'),read('app/retail/workspace/page.tsx')]);
 for(const source of [retail,workspace]){assert.match(source,/redirect\(`\/orby\?/);assert.doesNotMatch(source,/<OrbyChat/);}
 assert.match(dashboard,/\/orby\?conversation=new&organization=/);
});

test('Retail service-role config reuses production deployment secret',async()=>{
 const service=await read('src/lib/supabase/service.ts');assert.match(service,/deploymentSupabaseServiceRoleKey/);assert.match(service,/SUPABASE_SERVICE_ROLE_KEY/);
});

test('Platform Health is defensive and no longer reads stale pending_renewals',async()=>{
 const health=await read('app/admin/system-health/page.tsx');assert.doesNotMatch(health,/pending_renewals/);assert.match(health,/integration_incidents/);assert.match(health,/Unknown/);assert.match(health,/storageCheck/);
});

test('floating ORBY uses official asset and supports drag snap',async()=>{
 const floating=await read('components/orby/OrbyFloatingFace.tsx');assert.match(floating,/\/brand\/orby-assistant\.svg/);assert.match(floating,/onPointerMove/);assert.match(floating,/localStorage/);assert.match(floating,/prefers-reduced-motion/);assert.match(floating,/window\.innerWidth\/2/);
});

test('conversation RLS is user-owned and workspace scoped',async()=>{
 const migration=await read('supabase/migrations/20260812230015_orby_unified_account_plus.sql');
 for(const pattern of [/user_id=\(select auth\.uid\(\)\)/,/private\.is_organization_member\(organization_id\)/,/orby account conversations/,/orby account messages/])assert.match(migration,pattern);
 const api=await read('app/api/orby/conversations/route.ts');assert.match(api,/user_id=eq/);assert.match(api,/conversationId/);
});
