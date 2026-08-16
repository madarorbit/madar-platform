import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=(file)=>readFile(new URL(file,root),'utf8');
const adapter=await import(new URL('../src/lib/retail/analytics/adapter.ts',import.meta.url));
const core=await import(new URL('../src/lib/dashboard/metrics/core.ts',import.meta.url));

function rawSnapshot(overrides={}){
 const metrics={
  revenue:700,gross_sales:750,returns:50,estimated_cost_of_goods:400,
  estimated_gross_profit:300,retail_expenses:80,estimated_net_operating_result:220,
  orders:7,average_order_value:100,cash_position:900,cash_in:700,cash_out:100,
  retail_receivables:250,retail_payables:120,inventory_value:1500,
  ...(overrides.metrics||{})
 };
 return {
  workspace_id:'11111111-1111-1111-1111-111111111111',currency:'YER',timezone:'Asia/Aden',
  as_of:'2026-08-17T08:00:00.000Z',period:{from:'2026-08-11',to:'2026-08-17',days:7},metrics,
  comparison:{previous_from:'2026-08-04',previous_to:'2026-08-10',previous_revenue:600,revenue_change:100,revenue_change_percent:16.7},
  top_products:[{id:'p1',name:'منتج أ',sku:null,quantity_sold:3,revenue:300}],
  low_stock:[
   {id:'p2',name:'منتج نافد',sku:null,stock_on_hand:0,minimum_stock:2},
   {id:'p3',name:'منتج منخفض',sku:'LOW',stock_on_hand:1,minimum_stock:2},
  ],
  slow_moving:[],daily_sales:[{day:'2026-08-17',revenue:100}],recent_activity:[],
  definitions:{revenue:'صافي المبيعات بعد المرتجعات خلال الفترة'},
  ...overrides,
  metrics,
 };
}

test('Retail analytics adapter maps authoritative RPC keys to one stable typed contract',()=>{
 const normalized=adapter.normalizeRetailAnalyticsSnapshot(rawSnapshot());
 assert.equal(normalized.metrics.expenses,80);
 assert.equal(normalized.metrics.receivables,250);
 assert.equal(normalized.metrics.payables,120);
 assert.equal('retail_expenses' in normalized.metrics,false);
 assert.equal('retail_receivables' in normalized.metrics,false);
 assert.equal('retail_payables' in normalized.metrics,false);
});

test('authoritative RPC presence wins over legacy fallback even when the authoritative value is null',()=>{
 const authoritativeNull=rawSnapshot({metrics:{retail_expenses:null,expenses:999}});
 assert.throws(
  ()=>adapter.normalizeRetailAnalyticsSnapshot(authoritativeNull),
  /RETAIL_ANALYTICS_INVALID_NUMBER:metrics\.retail_expenses/
 );
 const legacyOnly=rawSnapshot({metrics:{expenses:81}});
 delete legacyOnly.metrics.retail_expenses;
 assert.equal(adapter.normalizeRetailAnalyticsSnapshot(legacyOnly).metrics.expenses,81);
});

test('required missing or invalid RPC metrics fail instead of silently becoming zero',()=>{
 const missing=rawSnapshot();
 delete missing.metrics.retail_expenses;
 assert.throws(()=>adapter.normalizeRetailAnalyticsSnapshot(missing),/RETAIL_ANALYTICS_INVALID_NUMBER:metrics\.retail_expenses/);
 const invalid=rawSnapshot({metrics:{retail_receivables:Number.NaN}});
 assert.throws(()=>adapter.normalizeRetailAnalyticsSnapshot(invalid),/RETAIL_ANALYTICS_INVALID_NUMBER:metrics\.retail_receivables/);
 const zero=adapter.normalizeRetailAnalyticsSnapshot(rawSnapshot({metrics:{retail_expenses:0}}));
 assert.equal(zero.metrics.expenses,0,'a real zero remains a business value');
});

test('Phase 5 domain declares exactly four primary, two supporting and four current-state metrics',async()=>{
 const source=await read('src/lib/retail/analytics/overview.ts');
 const primary=source.match(/RETAIL_PRIMARY_METRICS[\s\S]*?Object\.freeze\(\[([\s\S]*?)\] as const/)?.[1]||'';
 const supporting=source.match(/RETAIL_SUPPORTING_METRICS[\s\S]*?Object\.freeze\(\[([\s\S]*?)\] as const/)?.[1]||'';
 const current=source.match(/RETAIL_CURRENT_METRICS[\s\S]*?Object\.freeze\(\[([\s\S]*?)\] as const/)?.[1]||'';
 for(const id of ['retail.net_sales','retail.estimated_gross_profit','retail.estimated_operating_result','retail.invoice_count']) assert.ok(primary.includes(id),id);
 assert.equal((primary.match(/id:/g)||[]).length,4);
 assert.equal((supporting.match(/id:/g)||[]).length,2);
 assert.equal((current.match(/id:/g)||[]).length,4);
 assert.match(source,/id: "retail\.net_sales"[\s\S]*?comparison: "supported"/);
 for(const id of ['retail.estimated_gross_profit','retail.estimated_operating_result','retail.invoice_count','retail.expenses','retail.average_invoice']){
  const escaped=id.replaceAll('.','\\.');
  assert.match(source,new RegExp(`id: "${escaped}"[^\\n]*comparison: "none"`));
 }
 assert.match(source,/id: "retail\.cash_position"[^\n]*aggregation: "snapshot"/);
 assert.match(source,/id: "retail\.receivables"[^\n]*aggregation: "snapshot"/);
 assert.match(source,/id: "retail\.payables"[^\n]*aggregation: "snapshot"/);
 assert.match(source,/id: "retail\.inventory_value"[^\n]*aggregation: "snapshot"/);
});

test('current-state metrics are Phase 4 NormalizedMetricResult contracts, not raw value objects',async()=>{
 const [domain,page]=await Promise.all([
  read('src/lib/retail/analytics/overview.ts'),
  read('app/retail/workspace/page.tsx'),
 ]);
 assert.match(domain,/current: Readonly<Record<[\s\S]*?NormalizedMetricResult>>/);
 assert.match(domain,/function normalizedCurrentStateMetric/);
 assert.match(domain,/return normalizedRetailMetric\(snapshot, id, currentStateMetricPeriod\(snapshot\)\)/);
 assert.match(domain,/RETAIL_CURRENT_METRICS\.map\(\(item\) => \[item\.id, normalizedCurrentStateMetric\(snapshot, item\.id\)\]\)/);
 for(const contract of ['coverage: { state: "complete" }','dataAsOf: null','provenance: { category: "rpc", source: "retail_analytics_snapshot" }','calculatedAt: snapshot.as_of']) assert.ok(domain.includes(contract),contract);
 assert.match(page,/const result = overview\.current\[descriptor\.id\]/);
 assert.match(page,/value=\{metricValue\(result, workspace\.currency\)\}/);
 assert.doesNotMatch(page,/overview\.current\.find/);
 assert.doesNotMatch(page,/current\.currency/);
});

test('current-state snapshot period is tied to read context, not the selected performance range',async()=>{
 const source=await read('src/lib/retail/analytics/overview.ts');
 const currentPeriod=source.match(/function currentStateMetricPeriod\(snapshot: AnalyticsSnapshot\) \{([\s\S]*?)\n\}/)?.[1]||'';
 assert.match(currentPeriod,/snapshot\.as_of/);
 assert.match(currentPeriod,/snapshot\.timezone/);
 assert.match(currentPeriod,/metricPeriodFromDateSelection/);
 assert.doesNotMatch(currentPeriod,/selection|input\.from|input\.to/);
 assert.match(source,/aggregation: "snapshot"/);
});

test('Phase 5 period contract is based on Phase 4 timezone-aware inclusive/exclusive semantics',async()=>{
 const period=core.metricPeriodFromDateSelection({fromDate:'2026-08-11',toDateInclusive:'2026-08-17',timezone:'Asia/Aden'});
 assert.equal(period.fromInclusive,'2026-08-10T21:00:00.000Z');
 assert.equal(period.toExclusive,'2026-08-17T21:00:00.000Z');
 const source=await read('src/lib/retail/analytics/overview.ts');
 assert.match(source,/range: "7d" as const/);
 assert.match(source,/shiftMetricDate\(input\.today, -6\)/);
 assert.match(source,/metricPeriodFromDateSelection/);
});

test('sales zero-reference comparison remains mathematically unavailable and other Retail KPIs do not invent comparisons',async()=>{
 assert.deepEqual(core.calculateMetricComparison(700,0),{
  referenceValue:0,absoluteDelta:700,percentageDelta:null,percentageDeltaReason:'zero_reference'
 });
 const source=await read('src/lib/retail/analytics/overview.ts');
 assert.match(source,/id === "retail\.net_sales"/);
 assert.match(source,/previous_revenue/);
 assert.match(source,/comparison: "none"/);
 assert.equal(/favorable|unfavorable/.test(source),false);
});

test('inventory attention uses only stock zero and configured minimum-stock domain rules',async()=>{
 const source=await read('src/lib/retail/analytics/overview.ts');
 assert.match(source,/stock_on_hand === 0/);
 assert.match(source,/stock_on_hand > 0 && item\.stock_on_hand <= item\.minimum_stock/);
 assert.equal(/health score|cash warning|payables risk|slow_moving.*alert/i.test(source),false);
});

test('server query enforces the RPC adapter boundary instead of a blind TypeScript cast',async()=>{
 const source=await read('src/lib/retail/server/analytics/queries.ts');
 assert.match(source,/executeRetailRpc<unknown>/);
 assert.match(source,/normalizeRetailAnalyticsSnapshot\(raw\)/);
 assert.equal(/executeRetailRpc<AnalyticsSnapshot>/.test(source),false);
});

test('Retail page is a decision overview using shared dashboard and visualization layers',async()=>{
 const source=await read('app/retail/workspace/page.tsx');
 for(const contract of ['DashboardMetricCard','DashboardCriticalException','DashboardAlertBlock','DashboardVisualizationShell','TrendChart','DateRangeControl','DataTrustIndicator']) assert.ok(source.includes(contract),contract);
 assert.match(source,/productsResult\.value\.length === 0 && snapshot\.metrics\.orders === 0/);
 assert.match(source,/حاليًا/);
 assert.equal(source.includes('getRecentActivities'),false);
 assert.equal(source.includes('recent_activity.map'),false);
 assert.equal(source.includes('from "recharts"'),false);
 assert.equal(source.includes("from 'recharts'"),false);
 assert.match(source,/role !== "VIEWER"/);
});

test('Phase 5 keeps business definitions outside JSX and avoids sign-based outcome colors',async()=>{
 const [page,domain]=await Promise.all([
  read('app/retail/workspace/page.tsx'),
  read('src/lib/retail/analytics/overview.ts'),
 ]);
 for(const id of ['retail.estimated_gross_profit','retail.estimated_operating_result','retail.invoice_count']) assert.ok(domain.includes(id),id);
 assert.equal(/emerald|red-|green-|favorable|unfavorable/.test(page),false);
 assert.equal(page.includes('estimated_gross_profit -'),false);
 assert.equal(page.includes('revenue -'),false);
});
