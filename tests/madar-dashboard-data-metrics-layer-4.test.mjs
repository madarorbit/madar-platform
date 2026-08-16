import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=(file)=>readFile(new URL(file,root),'utf8');
const core=await import(new URL('../src/lib/dashboard/metrics/core.ts',import.meta.url));

const countDefinition={
 id:'example.count',version:'1',valueKind:'integer',unit:{kind:'count'},aggregation:'count',comparison:'supported'
};
const moneyDefinition={
 id:'example.money',version:'2',valueKind:'number',unit:{kind:'money',currency:'workspace'},aggregation:'sum',comparison:'supported'
};

test('metric registry is explicit, versioned, and rejects invalid or duplicate definitions',()=>{
 const registry=core.createMetricRegistry([countDefinition,moneyDefinition]);
 assert.equal(registry.require('example.count').version,'1');
 assert.equal(registry.list().length,2);
 assert.throws(()=>core.createMetricRegistry([countDefinition,countDefinition]),/METRIC_DUPLICATE_ID/);
 assert.throws(()=>core.createMetricRegistry([{...countDefinition,id:'Bad Metric'}]),/METRIC_INVALID_ID/);
 assert.throws(()=>core.createMetricRegistry([{...countDefinition,version:'   '}]),/METRIC_INVALID_VERSION/);
});

test('user date selections become timezone-aware inclusive/exclusive periods',()=>{
 const aden=core.metricPeriodFromDateSelection({fromDate:'2026-08-17',toDateInclusive:'2026-08-17',timezone:'Asia/Aden'});
 assert.equal(aden.fromInclusive,'2026-08-16T21:00:00.000Z');
 assert.equal(aden.toExclusive,'2026-08-17T21:00:00.000Z');
 assert.equal(aden.timezone,'Asia/Aden');

 const dst=core.metricPeriodFromDateSelection({fromDate:'2026-03-08',toDateInclusive:'2026-03-08',timezone:'America/New_York'});
 assert.equal(dst.fromInclusive,'2026-03-08T05:00:00.000Z');
 assert.equal(dst.toExclusive,'2026-03-09T04:00:00.000Z');
 assert.equal((Date.parse(dst.toExclusive)-Date.parse(dst.fromInclusive))/3600000,23);
 assert.throws(()=>core.metricPeriodFromDateSelection({fromDate:'2026-08-18',toDateInclusive:'2026-08-17',timezone:'Asia/Aden'}),/METRIC_INVALID_PERIOD_ORDER/);
});

test('comparison handles zero and missing reference without inventing percentage change',()=>{
 assert.deepEqual(core.calculateMetricComparison(25,0),{
  referenceValue:0,absoluteDelta:25,percentageDelta:null,percentageDeltaReason:'zero_reference'
 });
 assert.deepEqual(core.calculateMetricComparison(25,null),{
  referenceValue:null,absoluteDelta:null,percentageDelta:null,percentageDeltaReason:'missing_reference'
 });
 assert.equal(core.calculateMetricComparison(120,100).percentageDelta,20);
 const source=await read('src/lib/dashboard/metrics/core.ts');
 assert.equal(/favorable|unfavorable|success|danger/i.test(source),false,'math layer must not infer business outcome');
});

test('aggregation helpers preserve missing coverage and enforce ratio weighted and snapshot semantics',()=>{
 assert.deepEqual(core.sumMetricValues([10,null,5]),{value:15,coverage:'partial',observed:2,missing:1});
 assert.deepEqual(core.averageMetricValues([10,20]),{value:15,coverage:'complete',observed:2,missing:0});
 assert.deepEqual(core.distinctMetricCount(['a','a','b',null]),{value:2,coverage:'partial',observed:3,missing:1});
 assert.deepEqual(core.calculateMetricRatio(5,0),{value:null,reason:'zero_denominator'});
 assert.deepEqual(core.calculateMetricRatio(null,5),{value:null,reason:'missing_numerator'});
 assert.equal(core.weightedMetricAverage([{value:10,weight:1},{value:20,weight:3}]).value,17.5);
 assert.throws(()=>core.weightedMetricAverage([{value:10,weight:-1}]),/METRIC_NEGATIVE_WEIGHT/);
 assert.deepEqual(core.latestMetricSnapshot([
  {value:10,dataAsOf:'2026-08-01T00:00:00Z'},
  {value:14,dataAsOf:'2026-08-02T00:00:00Z'},
 ]),{value:14,dataAsOf:'2026-08-02T00:00:00.000Z'});
});

test('money resolves concrete workspace currency and forbids implicit FX',()=>{
 const unit=core.resolveMetricUnit(moneyDefinition,'yer');
 assert.deepEqual(unit,{kind:'money',currency:'YER'});
 core.assertMetricCurrency(unit,'YER');
 assert.throws(()=>core.assertMetricCurrency(unit,'SAR'),/METRIC_IMPLICIT_FX_FORBIDDEN/);
 assert.throws(()=>core.resolveMetricUnit(moneyDefinition,null),/METRIC_CURRENCY_REQUIRED/);
});

test('normalized results preserve true zero and keep missing as null',()=>{
 const period=core.metricPeriodFromDateSelection({fromDate:'2026-08-17',toDateInclusive:'2026-08-17',timezone:'Asia/Aden'});
 const calculatedAt='2026-08-17T09:00:00.000Z';
 const zero=core.normalizeMetricResult({
  definition:countDefinition,
  adapter:{value:0,coverage:{state:'complete'},dataAsOf:'2026-08-17T08:59:00.000Z',provenance:{category:'madar_native'},staleAfterSeconds:300,reference:{value:0}},
  period,calculatedAt,comparisonRequested:true
 });
 assert.equal(zero.value,0);
 assert.equal(zero.availability.state,'available');
 assert.equal(zero.comparison.percentageDelta,null);
 assert.equal(zero.comparison.percentageDeltaReason,'zero_reference');

 const missing=core.normalizeMetricResult({
  definition:countDefinition,
  adapter:{value:null,coverage:{state:'partial',ratio:0},dataAsOf:null,provenance:{category:'unknown'}},
  period,calculatedAt,comparisonRequested:false
 });
 assert.equal(missing.value,null);
 assert.equal(missing.availability.state,'missing');
 assert.equal(missing.freshness.state,'unknown');
 assert.throws(()=>core.normalizeMetricResult({
  definition:countDefinition,
  adapter:{value:null,availability:{state:'available'},coverage:{state:'complete'},provenance:{category:'unknown'}},
  period,calculatedAt,comparisonRequested:false
 }),/METRIC_AVAILABLE_WITHOUT_VALUE/);
});

test('freshness uses dataAsOf rather than calculatedAt and can remain unknown',()=>{
 assert.deepEqual(core.evaluateMetricFreshness({calculatedAt:'2026-08-17T10:00:00Z',dataAsOf:null}),{
  state:'unknown',reason:'missing_data_as_of'
 });
 const stale=core.evaluateMetricFreshness({calculatedAt:'2026-08-17T10:00:00Z',dataAsOf:'2026-08-17T09:00:00Z',staleAfterSeconds:1800});
 assert.equal(stale.state,'stale');
 assert.equal(stale.ageSeconds,3600);
 const unknownPolicy=core.evaluateMetricFreshness({calculatedAt:'2026-08-17T10:00:00Z',dataAsOf:'2026-08-17T09:59:00Z'});
 assert.equal(unknownPolicy.state,'unknown');
 assert.equal(unknownPolicy.reason,'missing_policy');
});

test('cache identity is deterministic and tenant scoped',()=>{
 const period=core.metricPeriodFromDateSelection({fromDate:'2026-08-01',toDateInclusive:'2026-08-31',timezone:'Asia/Aden'});
 const common={workspaceId:'w1',service:'service-x',definitions:[countDefinition],period,filters:[{key:'status',value:['b','a']}]};
 const a=core.buildMetricCacheIdentity({organizationId:'org-a',...common});
 const b=core.buildMetricCacheIdentity({organizationId:'org-b',...common});
 const reordered=core.buildMetricCacheIdentity({organizationId:'org-a',...common,filters:[{key:'status',value:['a','b']}]});
 assert.notEqual(a,b);
 assert.equal(a,reordered);
 assert.match(a,/example\.count@1/);
 assert.match(a,/Asia\/Aden/);
});

test('server boundary keeps authorization out of client query request and isolates metric failures',async()=>{
 const [contracts,server,index]=await Promise.all([
  read('src/lib/dashboard/metrics/contracts.ts'),
  read('src/lib/dashboard/metrics/server.ts'),
  read('src/lib/dashboard/metrics/index.ts'),
 ]);
 const queryBlock=contracts.match(/export type MetricQueryRequest = \{[\s\S]*?\n\};/)?.[0]||'';
 assert.ok(queryBlock);
 assert.equal(/organizationId|workspaceId/.test(queryBlock),false);
 assert.match(server,/import "server-only"/);
 assert.match(server,/authorizedMetricScopeBrand/);
 assert.match(server,/METRIC_UNTRUSTED_SCOPE/);
 assert.match(server,/Promise\.all/);
 assert.match(server,/errorMetricResult/);
 assert.match(server,/METRIC_ADAPTER_SERVICE_MISMATCH/);
 assert.equal(/from "\.\/server"/.test(index),false,'public barrel must not expose server executor');
});

test('shared metric layer is service neutral and has no fetching formula DSL or global KPI catalog',async()=>{
 const [contracts,core,server]=await Promise.all([
  read('src/lib/dashboard/metrics/contracts.ts'),
  read('src/lib/dashboard/metrics/core.ts'),
  read('src/lib/dashboard/metrics/server.ts'),
 ]);
 const shared=`${contracts}\n${core}\n${server}`;
 for(const forbidden of ['supabaseFetch','executeRetailRpc','fetch(','Revenue','Orders','Inventory','RetailSales','ConnectedSync','NativeOrders','SUM(x)','formula:']){
  assert.equal(shared.includes(forbidden),false,forbidden);
 }
 assert.match(contracts,/"sum"/);
 assert.match(contracts,/"ratio"/);
 assert.match(contracts,/"snapshot"/);
 assert.match(contracts,/"weighted_average"/);
});

test('legacy compatibility risks are documented without silently rewriting existing analytics',async()=>{
 const [analytics,business,doc]=await Promise.all([
  read('src/lib/analytics.ts'),read('src/lib/business.ts'),read('docs/MADAR_DASHBOARD_DATA_METRICS_LAYER_4.md')
 ]);
 assert.match(analytics,/Number\(value\|\|0\)/);
 assert.match(business,/Number\(value \|\| 0\)/);
 assert.match(doc,/Missing يتحول إلى Zero/);
 assert.match(doc,/generated_at/);
 assert.match(doc,/\[fromInclusive, toExclusive\)/);
 assert.match(doc,/لا يتم كسر RPC القديمة/);
});

test('phase 4 documentation preserves the service and infrastructure boundaries',async()=>{
 const doc=await read('docs/MADAR_DASHBOARD_DATA_METRICS_LAYER_4.md');
 for(const phrase of [
  'Metric Definition ≠ Metric Calculation ≠ Metric Presentation',
  'No implicit FX',
  'Zero ≠ Missing',
  'dataAsOf',
  'calculatedAt',
  'Partial failure',
  'Tenant isolation',
  'Definition versioning',
  'لا يوجد Generic `calculate(formula)` engine',
  'لا يبدأ Retail تلقائيًا',
 ]) assert.ok(doc.includes(phrase),phrase);
 assert.match(doc,/persistent metrics cache/);
 assert.match(doc,/Global KPI catalog/);
 assert.match(doc,/Data Warehouse|warehouse/);
});
