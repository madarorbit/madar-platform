import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260724050000_phase_four_orby_core.sql','utf8');
const hardening=fs.readFileSync('supabase/migrations/20260724050100_phase_four_orby_performance_hardening.sql','utf8');
const api=fs.readFileSync('app/api/orby/route.ts','utf8');
const orby=fs.readFileSync('src/lib/orby.ts','utf8');
const page=fs.readFileSync('app/workspace/orby/page.tsx','utf8');
const actions=fs.readFileSync('app/actions/orby.ts','utf8');

test('ORBY memory is isolated by user and organization',()=>{
 for(const table of ['orby_conversations','orby_messages','orby_usage_daily','orby_insights','orby_action_drafts']){
  assert.match(migration,new RegExp(`create table public\\.${table}`));
  assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`));
 }
 assert.match(migration,/user_id=\(select auth\.uid\(\)\) and private\.is_organization_member\(organization_id\)/);
 assert.match(migration,/members read orby insights/);
 assert.match(migration,/revoke all on table public\.orby_conversations,public\.orby_messages/);
 assert.doesNotMatch(migration,/grant (insert|update|delete) on table public\.orby_/);
});

test('ORBY enforces daily quotas before generation',()=>{
 assert.match(migration,/private\.consume_orby_quota_impl/);
 assert.match(migration,/requests<20/);
 assert.match(migration,/100000/);
 assert.match(migration,/ORBY_DAILY_LIMIT/);
 assert.match(api,/rpc\/consume_orby_quota/);
 assert.ok(api.indexOf('rpc/consume_orby_quota')<api.indexOf('generateText'));
});

test('ORBY context comes from checked workspace analytics only',()=>{
 assert.match(migration,/private\.orby_business_context_impl/);
 assert.match(migration,/private\.can_manage_business\(target_organization,'financials'\)/);
 assert.match(migration,/private\.business_analytics_impl/);
 assert.match(migration,/organization_id=target_organization/g);
 assert.match(api,/rpc\/orby_business_context/);
 assert.match(orby,/لا تختلق أرقاماً أو عملاء أو منتجات/);
});

test('AI provider failure falls back without leaking provider details',()=>{
 assert.match(api,/source='smart-fallback'/);
 assert.match(api,/deterministicOrbyResponse/);
 assert.match(api,/provider_unavailable:providerUnavailable/);
 assert.doesNotMatch(api,/provider_error/);
 assert.match(orby,/هذا رد تشغيلي تلقائي من بيانات مَدار/);
});

test('proactive insights are deterministic and actionable',()=>{
 for(const insight of ['OUT_OF_STOCK','LOW_STOCK','OVERDUE_TASKS','REVENUE_DECLINE','EXPENSE_SPIKE','INACTIVE_CUSTOMERS'])assert.match(migration,new RegExp(insight));
 assert.match(migration,/unique\(organization_id,fingerprint\)/);
 assert.match(actions,/rpc\/refresh_orby_insights/);
 assert.match(page,/تنبيهات أوربي الاستباقية/);
 assert.match(page,/تحديث التنبيهات الذكية/);
});

test('ORBY actions require draft then explicit confirmation',()=>{
 assert.match(migration,/action_type text not null check\(action_type in \('create_task'\)\)/);
 assert.match(migration,/private\.create_orby_task_draft_impl/);
 assert.match(migration,/private\.confirm_orby_action_impl/);
 assert.match(migration,/draft\.status<>'draft'/);
 assert.match(migration,/orby\.action\.confirmed/);
 assert.match(actions,/rpc\/create_orby_task_draft/);
 assert.match(actions,/rpc\/confirm_orby_action/);
 assert.match(page,/لن تظهر المهمة في مساحة العمل إلا بعد تأكيدك/);
 assert.match(page,/تأكيد التنفيذ/);
});

test('ORBY foreign keys have covering indexes',()=>{
 assert.match(hardening,/orby_action_drafts_org_idx/);
 assert.match(hardening,/orby_conversations_org_idx/);
 assert.match(hardening,/orby_messages_user_idx/);
 assert.match(hardening,/orby_usage_daily_user_idx/);
});
