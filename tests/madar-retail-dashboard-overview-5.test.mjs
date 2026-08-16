import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=(file)=>readFile(new URL(file,root),'utf8');
const adapter=await import(new URL('../src/lib/retail/analytics/adapter.ts',import.meta.url));
const overview=await import(new URL('../src/lib/retail/analytics/overview.ts',import.meta.url));

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

test('required missing or invalid RPC metrics fail instead of silently becoming zero',()=>{
 const missing=rawSnapshot();
 delete missing.metrics.retail_expenses;
 assert.throws(()=>adapter.normalizeRetailAnalyticsSnapshot(missing),/RETAIL_ANALYTICS_INVALID_NUMBER:metrics\.retail_expenses/);
 const invalid=rawSnapshot({metrics:{retail_receivables:Number.NaN}});
 assert.throws(()=>adapter.normalizeRetailAnalyticsSnapshot(invalid),/RETAIL_ANALYTICS_INVALID_NUMBER:metrics\.retail_receivables/);
 const zero=adapter.normalizeRetailAnalyticsSnapshot(rawSnapshot({metrics:{retail_expenses:0}}));
 assert.equal(zero.metrics.expenses,0,'a real zero remains a business value');
});

test('Phase 5 registry has exactly four primary KPIs and only net sales supports comparison',()=>{
 assert.deepEqual(overview.RETAIL_PRIMARY_METRICS.map((item)=>item.id),[
  'retail.net_sales','retail.estimated_gross_profit','retail.estimated_operating_result','retail.invoice_count'
 ]);
 assert.deepEqual(overview.RETAIL_SUPPORTING_METRICS.map((item)=>item.id),['retail.expenses','retail.average_invoice']);
 assert.deepEqual(overview.RETAIL_CURRENT_METRICS.map((item)=>item.id),[
  'retail.cash_position','retail.receivables','retail.payables','retail.inventory_value'
 ]);
 assert.equal(overview.retailOverviewMetricRegistry.require('retail.net_sales').comparison,'supported');
 for(const definition of overview.retailOverviewMetricRegistry.list()){
  if(definition.id!=='retail.net_sales') assert.equal(definition.comparison,'none',definition.id);
 }
 assert.equal(overview.retailOverviewMetricRegistry.require('retail.cash_position').aggregation,'snapshot');
 assert.equal(overview.retailOverviewMetricRegistry.require('retail.inventory_value').aggregation,'snapshot');
});

test('Retail Overview defaults to seven days and uses Phase 4 timezone-aware period boundaries',()=>{
 const selection=overview.resolveRetailOverviewSelection({timezone:'Asia/Aden',today:'2026-08-17'});
 assert.equal(selection.range,'7d');
 assert.equal(selection.from,'2026-08-11');
 assert.equal(selection.to,'2026-08-17');
 assert.equal(selection.period.fromInclusive,'2026-08-10T21:00:00.000Z');
 assert.equal(selection.period.toExclusive,'2026-08-17T21:00:00.000Z');
 const custom=overview.resolveRetailOverviewSelection({timezone:'Asia/Aden',today:'2026-08-17',from:'2026-08-01',to:'2026-08-05'});
 assert.equal(custom.range,'custom');
 assert.equal(custom.from,'2026-08-01');
 assert.equal(custom.to,'2026-08-05');
});

test('Overview model keeps comparison truthful and separates critical from attention inventory',()=>{
 const snapshot=adapter.normalizeRetailAnalyticsSnapshot(rawSnapshot({comparison:{previous_from:'2026-08-04',previous_to:'2026-08-10',previous_revenue:0,revenue_change:700,revenue_change_percent:null}}));
 const selection=overview.resolveRetailOverviewSelection({range:'7d',timezone:'Asia/Aden',today:'2026-08-17'});
 const model=overview.buildRetailOverviewModel(snapshot,selection);
 const comparison=model.primary['retail.net_sales'].comparison;
 assert.equal(comparison.kind,'previous');
 assert.equal(comparison.referenceValue,0);
 assert.equal(comparison.percentageDelta,null);
 assert.equal(comparison.percentageDeltaReason,'zero_reference');
 assert.equal(model.primary['retail.estimated_gross_profit'].comparison,null);
 assert.deepEqual(model.criticalInventory.map((item)=>item.id),['p2']);
 assert.deepEqual(model.attentionInventory.map((item)=>item.id),['p3']);
 assert.equal(model.current.find((item)=>item.id==='retail.cash_position').value,900);
});

test('server query enforces the RPC adapter boundary instead of a blind TypeScript cast',async()=>{
 const source=await read('src/lib/retail/server/analytics/queries.ts');
 assert.match(source,/executeRetailRpc<unknown>/);
 assert.match(source,/normalizeRetailAnalyticsSnapshot\(raw\)/);
 assert.equal(/executeRetailRpc<AnalyticsSnapshot>/.test(source),false);
});

test('Retail page is a decision overview using shared dashboard and visualization layers',async()=>{
 const source=await read('app/retail/workspace/page.tsx');
 assert.match(source,/DashboardMetricCard/);
 assert.match(source,/DashboardCriticalException/);
 assert.match(source,/DashboardAlertBlock/);
 assert.match(source,/DashboardVisualizationShell/);
 assert.match(source,/TrendChart/);
 assert.match(source,/DateRangeControl/);
 assert.match(source,/DataTrustIndicator/);
 assert.match(source,/productsResult\.value\.length === 0 && snapshot\.metrics\.orders === 0/);
 assert.match(source,/الربح الإجمالي التقديري|RETAIL_PRIMARY_METRICS/);
 assert.match(source,/حاليًا/);
 assert.equal(source.includes('getRecentActivities'),false);
 assert.equal(source.includes('recent_activity.map'),false);
 assert.equal(source.includes('from "recharts"'),false);
 assert.equal(source.includes("from 'recharts'"),false);
 assert.match(source,/role !== "VIEWER"/);
});

test('Phase 5 keeps business definitions outside JSX and does not add sign-based outcome semantics',async()=>{
 const [page,domain]=await Promise.all([
  read('app/retail/workspace/page.tsx'),
  read('src/lib/retail/analytics/overview.ts'),
 ]);
 assert.match(domain,/retail\.estimated_gross_profit/);
 assert.match(domain,/retail\.estimated_operating_result/);
 assert.match(domain,/retail\.invoice_count/);
 assert.equal(/emerald|red-|green-|favorable|unfavorable/.test(page),false);
 assert.equal(page.includes('estimated_gross_profit -'),false);
 assert.equal(page.includes('revenue -'),false);
});
