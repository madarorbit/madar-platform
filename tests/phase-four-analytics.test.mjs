import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260724040000_phase_four_business_analytics.sql','utf8');
const wrapperFix=fs.readFileSync('supabase/migrations/20260724040100_rpc_wrapper_execution_fix.sql','utf8');
const page=fs.readFileSync('app/workspace/analytics/page.tsx','utf8');
const exportRoute=fs.readFileSync('app/workspace/analytics/export/route.ts','utf8');
const helpers=fs.readFileSync('src/lib/analytics.ts','utf8');

test('analytics is calculated inside a protected tenant-aware database function',()=>{
 assert.match(migration,/private\.business_analytics_impl/);
 assert.match(migration,/private\.can_manage_business\(target_organization,'financials'\)/);
 assert.match(migration,/DATE_RANGE_TOO_LARGE/);
 assert.match(migration,/day_count > 366/);
 assert.match(migration,/organization_id=target_organization/g);
 assert.match(migration,/revoke all on function private\.business_analytics_impl/);
 assert.match(migration,/grant execute on function public\.business_analytics/);
});

test('business metrics include revenue costs profit customers stock and tasks',()=>{
 for(const metric of ['revenue','cost_of_goods','gross_profit','expenses','net_profit_estimate','active_customers','returning_customers','low_stock','inventory_value','overdue_tasks']){
  assert.match(migration,new RegExp(`'${metric}'`));
 }
 assert.match(migration,/private\.percentage_change/);
 assert.match(migration,/daily_sales/);
 assert.match(migration,/daily_expenses/);
 assert.match(migration,/top_products/);
});

test('public wrappers execute as owner while private implementations remain protected',()=>{
 const wrappers=['adjust_inventory','business_analytics','commit_business_import','create_customer_order','create_workspace_request','ensure_student_workspace','list_organization_members','manage_organization_member','record_business_sale','review_order_payment','review_workspace_request','rollback_business_import','submit_order_payment','submit_workspace_payment','sync_student_reminders','update_order_fulfillment'];
 for(const name of wrappers)assert.match(wrapperFix,new RegExp(`alter function public\\.${name}\\(`));
 assert.match(wrapperFix,/security definer/g);
 assert.doesNotMatch(wrapperFix,/grant execute on function private\./);
});

test('analytics range is timezone-aware and bounded',()=>{
 assert.match(helpers,/timeZone:'Asia\/Aden'/);
 assert.match(helpers,/days<1\|\|days>366/);
 assert.match(helpers,/rpc\/business_analytics/);
});

test('dashboard supports comparisons charts CSV and printable PDF workflow',()=>{
 assert.match(page,/المقارنة بالفترة السابقة/);
 assert.match(page,/AnalyticsBars/);
 assert.match(page,/تصدير CSV/);
 assert.match(page,/تقرير للطباعة \/ PDF/);
 assert.match(page,/صافي الربح التقديري/);
 assert.match(exportRoute,/Content-Disposition/);
 assert.match(exportRoute,/text\/csv/);
 assert.match(exportRoute,/Cache-Control':'private, no-store/);
});
