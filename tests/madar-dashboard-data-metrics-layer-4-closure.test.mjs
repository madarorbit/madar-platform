import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=(file)=>readFile(new URL(file,root),'utf8');
const core=await import(new URL('../src/lib/dashboard/metrics/core.ts',import.meta.url));

const countDefinition={id:'example.count',version:'1',valueKind:'integer',unit:{kind:'count'},aggregation:'count',comparison:'supported'};
const moneyDefinition={id:'example.money',version:'2',valueKind:'number',unit:{kind:'money',currency:'workspace'},aggregation:'sum',comparison:'supported'};
const period=core.metricPeriodFromDateSelection({fromDate:'2026-08-10',toDateInclusive:'2026-08-16',timezone:'Asia/Aden'});
const referencePeriod=core.metricPeriodFromDateSelection({fromDate:'2026-08-03',toDateInclusive:'2026-08-09',timezone:'Asia/Aden'});
const cacheBase={organizationId:'org-a',workspaceId:'w1',service:'service-x',definitions:[countDefinition],period};

test('normalized metric comparison carries kind and period with the numeric result',()=>{
 const result=core.normalizeMetricResult({
  definition:countDefinition,
  adapter:{value:120,coverage:{state:'complete'},dataAsOf:'2026-08-16T20:00:00Z',provenance:{category:'madar_native'},reference:{value:100}},
  period,
  calculatedAt:'2026-08-16T20:10:00Z',
  comparison:{kind:'previous',period:referencePeriod}
 });
 assert.deepEqual(result.comparison,{
  kind:'previous',
  period:referencePeriod,
  referenceValue:100,
  absoluteDelta:20,
  percentageDelta:20,
  percentageDeltaReason:null
 });
});

test('cache identity distinguishes comparison kind even when reference period is identical',()=>{
 const previous=core.buildMetricCacheIdentity({...cacheBase,comparison:{kind:'previous',period:referencePeriod}});
 const benchmark=core.buildMetricCacheIdentity({...cacheBase,comparison:{kind:'benchmark',period:referencePeriod}});
 const reference=core.buildMetricCacheIdentity({...cacheBase,comparison:{kind:'reference',period:referencePeriod}});
 assert.notEqual(previous,benchmark);
 assert.notEqual(previous,reference);
 assert.notEqual(benchmark,reference);
 assert.match(previous,/"comparison":\{"kind":"previous","period":/);
 assert.match(previous,/2026-08-02T21:00:00\.000Z/);
});

test('typed canonical filter encoding prevents scalar type collisions',()=>{
 const numeric=core.buildMetricCacheIdentity({...cacheBase,filters:[{key:'value',value:1}]});
 const numericString=core.buildMetricCacheIdentity({...cacheBase,filters:[{key:'value',value:'1'}]});
 const boolean=core.buildMetricCacheIdentity({...cacheBase,filters:[{key:'value',value:true}]});
 const booleanString=core.buildMetricCacheIdentity({...cacheBase,filters:[{key:'value',value:'true'}]});
 assert.notEqual(numeric,numericString);
 assert.notEqual(boolean,booleanString);
 assert.match(numeric,/"type":"number","value":1/);
 assert.match(numericString,/"type":"string","value":"1"/);
 assert.match(boolean,/"type":"boolean","value":true/);
 assert.match(booleanString,/"type":"string","value":"true"/);
});

test('typed filter arrays remain order-canonical without erasing types',()=>{
 const a=core.buildMetricCacheIdentity({...cacheBase,filters:[{key:'mixed',value:[1,'1',true,'true']}]});
 const b=core.buildMetricCacheIdentity({...cacheBase,filters:[{key:'mixed',value:['true',true,'1',1]}]});
 assert.equal(a,b);
 assert.match(a,/"type":"number"/);
 assert.match(a,/"type":"string"/);
 assert.match(a,/"type":"boolean"/);
 assert.throws(()=>core.buildMetricCacheIdentity({...cacheBase,filters:[{key:'bad',value:Number.NaN}]}),/METRIC_INVALID_FILTER_NUMBER/);
});

test('cache identity preserves requested metric order because batch results preserve request order',()=>{
 const common={organizationId:'org-a',workspaceId:'w1',service:'service-x',period};
 const countThenMoney=core.buildMetricCacheIdentity({...common,definitions:[countDefinition,moneyDefinition]});
 const moneyThenCount=core.buildMetricCacheIdentity({...common,definitions:[moneyDefinition,countDefinition]});
 assert.notEqual(countThenMoney,moneyThenCount);
 assert.ok(countThenMoney.indexOf('example.count@1')<countThenMoney.indexOf('example.money@2'));
 assert.ok(moneyThenCount.indexOf('example.money@2')<moneyThenCount.indexOf('example.count@1'));
});

test('server wiring forwards full comparison context and documents request-order result semantics',async()=>{
 const [contracts,server,doc]=await Promise.all([
  read('src/lib/dashboard/metrics/contracts.ts'),
  read('src/lib/dashboard/metrics/server.ts'),
  read('docs/MADAR_DASHBOARD_DATA_METRICS_LAYER_4_CLOSURE_PATCH.md')
 ]);
 assert.match(contracts,/MetricComparison = MetricComparisonValues/);
 assert.match(contracts,/Results preserve MetricQueryRequest\.metricIds order/);
 assert.match(server,/comparison: context\.comparison/);
 assert.match(server,/comparison: input\.context\.comparison/);
 assert.equal(server.includes('comparisonPeriod:'),false);
 assert.match(doc,/self-describing comparison/i);
 assert.match(doc,/comparison kind \+ period/i);
 assert.match(doc,/typed filter encoding/i);
 assert.match(doc,/request order/i);
});
