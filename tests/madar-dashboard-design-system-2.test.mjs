import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('dashboard shared layer loads after base design system and before service compositions',async()=>{
 const globals=await read('app/globals.css');
 const base=globals.indexOf('design-system-2-surfaces.css');
 const dashboard=globals.indexOf('dashboard-design-system-2.css');
 const services=globals.indexOf('services-experience-5.css');
 assert.ok(base>=0&&dashboard>base&&services>dashboard);
});

test('shared dashboard contracts stay service neutral and UI only',async()=>{
 const [components,types]=await Promise.all([read('components/dashboard/Dashboard.tsx'),read('components/dashboard/types.ts')]);
 for(const forbidden of ['RetailRevenueCard','ConnectedSyncAlert','NativeOrdersPanel','MADAR Retail','Connected Business','Native Business']){
  assert.equal(`${components}\n${types}`.includes(forbidden),false,forbidden);
 }
 for(const forbidden of ['supabase','migration','organization_id','revenue','orders','inventory']){
  assert.equal(types.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
 }
 assert.match(types,/DashboardTrustState/);
 assert.match(types,/"partial"/);
 assert.match(types,/"stale"/);
 assert.match(types,/DashboardFilterScope = "global" \| "local"/);
});

test('metric card keeps comparison and secondary context optional without good bad semantics',async()=>{
 const components=await read('components/dashboard/Dashboard.tsx');
 assert.match(components,/export function DashboardMetricCard/);
 assert.match(components,/comparison\?: ReactNode/);
 assert.match(components,/supportingContext\?: ReactNode/);
 assert.match(components,/trust\?: ReactNode/);
 assert.match(components,/status\?: ReactNode/);
 assert.match(components,/action\?: ReactNode/);
 assert.match(components,/valueDirection\?: ValueDirection/);
 assert.match(components,/export function MetricContext/);
 assert.equal(/positiveMetric|negativeMetric|goodMetric|badMetric/i.test(components),false);
});

test('status insight alert and critical exception are separate semantic components',async()=>{
 const components=await read('components/dashboard/Dashboard.tsx');
 for(const name of ['DashboardStatusBlock','DashboardInsightBlock','DashboardAlertBlock','DashboardCriticalException']){
  assert.match(components,new RegExp(`export function ${name}`));
 }
 assert.match(components,/الحالة الحالية/);
 assert.match(components,/ملاحظة/);
 assert.match(components,/يحتاج انتباهًا/);
 assert.match(components,/aria-label="استثناء حرج"/);
 assert.match(components,/aria-live="assertive"/);
});

test('first class dashboard states separate no meaningful data from true zero',async()=>{
 const components=await read('components/dashboard/Dashboard.tsx');
 for(const name of ['DataTrustIndicator','DashboardDataState','DashboardEmptyState','DashboardLoadingState','DashboardErrorState']){
  assert.match(components,new RegExp(`export function ${name}`));
 }
 assert.match(components,/data-empty-kind="no-meaningful-data"/);
 for(const state of ['fresh','syncing','stale','partial','unknown','error'])assert.ok(components.includes(`${state}:`),state);
});

test('global local filters active state and date range have explicit accessible patterns',async()=>{
 const components=await read('components/dashboard/Dashboard.tsx');
 assert.match(components,/export function DashboardFilterBar/);
 assert.match(components,/data-filter-scope=\{scope\}/);
 assert.match(components,/مرشحات النظرة العامة/);
 assert.match(components,/مرشحات هذا القسم/);
 assert.match(components,/export function ActiveFilterChip/);
 assert.match(components,/إزالة المرشح:/);
 assert.match(components,/export function DateRangeControl/);
 assert.match(components,/type="date"/);
 assert.match(components,/dir="ltr"/);
 assert.match(components,/aria-current=\{preset\.active \? "page" : undefined\}/);
});

test('dashboard CSS uses existing semantic tokens and preserves mobile priority',async()=>{
 const css=await read('app/dashboard-design-system-2.css');
 assert.equal(/#[0-9a-f]{3,8}\b/i.test(css),false,'dashboard CSS must not introduce raw colors');
 assert.equal(/chart-positive|chart-negative|positiveMetric|negativeMetric/i.test(css),false);
 for(const token of ['var(--md-surface)','var(--md-text-primary)','var(--md-border-default)','var(--md-warning)','var(--md-danger)'])assert.ok(css.includes(token),token);
 assert.match(css,/@media \(max-width: 1023px\)/);
 assert.match(css,/@media \(max-width: 639px\)/);
 assert.match(css,/\.md-dashboard-metric-grid \{ grid-template-columns: 1fr;/);
 assert.match(css,/\.md-dashboard-critical \{/);
 assert.equal(/\.md-dashboard-critical[^}]*display:\s*none/s.test(css),false);
 assert.match(css,/prefers-reduced-motion: reduce/);
});

test('visualization shell is chart type neutral and supports structural states',async()=>{
 const components=await read('components/dashboard/Dashboard.tsx');
 assert.match(components,/export function DashboardVisualizationShell/);
 assert.match(components,/state\?: DashboardModuleState/);
 for(const forbidden of ['LineChart','BarChart','PieChart','DonutChart','XAxis','YAxis'])assert.equal(components.includes(forbidden),false,forbidden);
});

test('protected catalog proves Arabic RTL-oriented dashboard states with UI fixtures only',async()=>{
 const [page,showcase,adminLayout]=await Promise.all([read('app/admin/design-system/page.tsx'),read('components/admin/DashboardDesignSystemShowcase.tsx'),read('app/admin/layout.tsx')]);
 assert.match(page,/DashboardDesignSystemShowcase/);
 assert.match(adminLayout,/requireAdmin/);
 assert.match(showcase,/بيانات توضيحية للواجهة فقط/);
 assert.match(showcase,/DashboardCriticalException/);
 assert.match(showcase,/DashboardFilterBar/);
 assert.match(showcase,/DashboardVisualizationShell/);
 assert.equal(/getAnalyticsSnapshot|supabaseFetch|business_analytics|retail_analytics/i.test(showcase),false);
});

test('phase 2 documentation references phase 1 and preserves phase 3 and service boundaries',async()=>{
 const doc=await read('docs/MADAR_DASHBOARD_DESIGN_SYSTEM_2.md');
 assert.match(doc,/MADAR_DASHBOARD_INFORMATION_ARCHITECTURE_1\.md/);
 for(const section of ['DashboardMetricCard','Status / Insight / Alert / Critical Exception','Responsive contract','Light / Dark','Accessibility baseline','مؤجل إلى Phase 3.0','مؤجل إلى Phase 4.0'])assert.ok(doc.includes(section),section);
 assert.match(doc,/--md-chart-positive/);
 assert.match(doc,/لم تستخدم هذه الرموز/);
});
