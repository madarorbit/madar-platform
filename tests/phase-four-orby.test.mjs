import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const legacyMigration=fs.readFileSync('supabase/migrations/20260724050000_phase_four_orby_core.sql','utf8');
const hardening=fs.readFileSync('supabase/migrations/20260724050100_phase_four_orby_performance_hardening.sql','utf8');
const unifiedMigration=fs.readFileSync('supabase/migrations/20260812230015_orby_unified_account_plus.sql','utf8');
const runtimeFix=fs.readFileSync('supabase/migrations/20260813001000_fix_orby_persistence_and_scoped_context.sql','utf8');
const stream=fs.readFileSync('app/api/orby/stream/route.ts','utf8');
const orby=fs.readFileSync('src/lib/orby.ts','utf8');
const actions=fs.readFileSync('app/actions/orby.ts','utf8');
const runtimeResolver=fs.readFileSync('supabase/migrations/20260731120000_orby_runtime_config_resolver.sql','utf8');
const coreAdapter=fs.readFileSync('src/lib/orby/adapters/supabase.ts','utf8');

test('ORBY keeps account conversations user-owned and workspace data tenant-scoped',()=>{
 for(const table of ['orby_conversations','orby_messages','orby_usage_daily'])assert.match(unifiedMigration,new RegExp(`alter table public\\.${table}`));
 assert.match(unifiedMigration,/orby account conversations/);
 assert.match(unifiedMigration,/orby account messages/);
 assert.match(unifiedMigration,/user_id=\(select auth\.uid\(\)\)/);
 assert.match(unifiedMigration,/organization_id is null or private\.is_organization_member\(organization_id\)/);
 assert.match(runtimeFix,/drop trigger if exists madar_v2_orby_access_guard on public\.orby_conversations/);
 assert.match(runtimeFix,/drop trigger if exists madar_v2_orby_access_guard on public\.orby_messages/);
});

test('ORBY central quota supports Free 5, paid customer 20 and Plus fair-use',()=>{
 assert.match(stream,/consume_orby_account_quota/);
 assert.match(stream,/reserve_orby_guest_request/);
 assert.match(unifiedMigration,/daily_limit',20/);
 assert.match(unifiedMigration,/daily_limit',5/);
 assert.match(unifiedMigration,/tier','plus/);
 assert.match(unifiedMigration,/used<30/);
 assert.match(unifiedMigration,/used<1000/);
 assert.match(unifiedMigration,/ORBY_DAILY_LIMIT/);
 assert.ok(stream.indexOf("usage=scalar<Usage>")<stream.indexOf("const foundation=scope"));
});

test('ORBY context is loaded only after active service scope authorization',()=>{
 assert.match(stream,/workspace_subscriptions\?organization_id=eq\./);
 assert.match(stream,/activation_state=eq\.ACTIVE/);
 assert.match(stream,/rpc\/orby_business_context/);
 assert.match(stream,/retailEvidence/);
 assert.match(stream,/retail_analytics_snapshot/);
 assert.match(orby,/لا تخلط بين مساحات أو خدمات/);
 assert.match(orby,/لا تختلق أرقام/);
 assert.match(runtimeFix,/alter function public\.orby_business_context\(uuid\) security definer/);
});

test('provider failure uses safe fallback without exposing provider errors',()=>{
 assert.match(stream,/smart-fallback/);
 assert.match(stream,/deterministicOrbyResponse/);
 assert.match(stream,/deterministicGeneralOrbyResponse/);
 assert.doesNotMatch(stream,/provider_error/);
 assert.match(orby,/تعذر الوصول إلى محرك الذكاء الآن/);
 assert.match(orby,/تحليل أوربي المبني على بيانات المساحة/);
});

test('unified chat executes through governed ORBY core',()=>{
 assert.match(stream,/createServerOrbyFoundation/);
 assert.match(stream,/createAccountOrbyFoundation/);
 assert.match(stream,/foundation\.kernel/);
 assert.match(stream,/kernel_session_id/);
 assert.match(stream,/provider_id/);
 assert.match(stream,/model_id/);
 assert.doesNotMatch(stream,/openrouter\.ai|api\.openai\.com|generativelanguage\.googleapis\.com/i);
});

test('runtime settings remain credential-free for members',()=>{
 assert.match(runtimeResolver,/private\.is_admin\(\)/);
 assert.match(runtimeResolver,/organization_members/);
 assert.match(runtimeResolver,/jsonb_build_object\(/);
 assert.match(runtimeResolver,/'allowedProviderIds'/);
 assert.match(runtimeResolver,/'allowedModelIds'/);
 assert.doesNotMatch(runtimeResolver,/\b(api_key|provider_secret|credential)\b\s+(text|jsonb|bytea)/i);
 assert.match(coreAdapter,/rpc\/orby_resolve_runtime_config/);
});

test('proactive business insights and explicit-confirmation actions remain available outside composer modes',()=>{
 for(const insight of ['OUT_OF_STOCK','LOW_STOCK','OVERDUE_TASKS','REVENUE_DECLINE','EXPENSE_SPIKE','INACTIVE_CUSTOMERS'])assert.match(legacyMigration,new RegExp(insight));
 assert.match(actions,/rpc\/refresh_orby_insights/);
 assert.match(legacyMigration,/private\.create_orby_task_draft_impl/);
 assert.match(legacyMigration,/private\.confirm_orby_action_impl/);
 assert.match(actions,/rpc\/create_orby_task_draft/);
 assert.match(actions,/rpc\/confirm_orby_action/);
 assert.doesNotMatch(stream,/body\.mode/);
});

test('ORBY foreign keys keep covering indexes',()=>{
 assert.match(hardening,/orby_action_drafts_org_idx/);
 assert.match(hardening,/orby_conversations_org_idx/);
 assert.match(hardening,/orby_messages_user_idx/);
 assert.match(hardening,/orby_usage_daily_user_idx/);
});
