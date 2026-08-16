import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=(file)=>readFile(new URL(file,root),'utf8');
const domain=await import(new URL('../src/lib/connected/dashboard/domain.ts',import.meta.url));

const calculatedAt='2026-08-17T00:00:00.000Z';

function health(status='healthy',overrides={}){
 return {id:`h-${status}`,connection_id:'c1',status,freshness_seconds:300,success_rate:100,quality_score:95,queue_depth:0,open_issues:0,captured_at:'2026-08-16T23:55:00.000Z',...overrides};
}

function run(status='succeeded',overrides={}){
 return {id:`r-${status}`,connection_id:'c1',sync_mode:'incremental',status,records_received:10,error_message:null,started_at:'2026-08-16T23:40:00.000Z',finished_at:'2026-08-16T23:41:00.000Z',...overrides};
}

function source(overrides={}){
 return {
  connection_id:'c1',name:'المصدر الأول',connector_key:'source_one',connection_status:'active',connection_mode:'READ_ONLY',
  last_success_at:'2026-08-16T23:41:00.000Z',last_error_message:null,created_at:'2026-08-01T00:00:00.000Z',
  latest_health:health(),latest_run:run(),open_incident_count:0,
  has_critical_incident:false,has_error_incident:false,has_warning_incident:false,
  ...overrides,
 };
}

function dashboardData(sources,{factsFailed=false,connectionsFailed=false,recordsFailed=false,hasRecords=true}={}){
 const open=sources.reduce((sum,item)=>sum+item.open_incident_count,0);
 const summary={
  connection_count:sources.length,
  open_incident_count:open,
  sources_with_critical_incident:sources.filter((item)=>item.has_critical_incident).length,
  sources_with_error_incident:sources.filter((item)=>item.has_error_incident).length,
  sources_with_warning_incident:sources.filter((item)=>item.has_warning_incident).length,
  latest_success_at:sources.map((item)=>item.last_success_at).filter(Boolean).sort().at(-1)||null,
 };
 return {
  connections:{failed:connectionsFailed,data:connectionsFailed?[]:sources.map((item)=>({id:item.connection_id,name:item.name,connector_key:item.connector_key,status:item.connection_status,connection_mode:item.connection_mode,last_success_at:item.last_success_at,last_error_message:item.last_error_message,created_at:item.created_at}))},
  facts:{failed:factsFailed,data:factsFailed?null:{sources,summary}},
  records:{failed:recordsFailed,data:{hasRecords:recordsFailed?false:hasRecords,latestRecordUpdatedAt:hasRecords?'2026-08-16T23:50:00.000Z':null,latestSourceUpdatedAt:null}},
 };
}

test('active connection plus unhealthy latest health is never ready or healthy',()=>{
 const model=domain.buildConnectedOverviewModel(dashboardData([source({latest_health:health('unhealthy')})]),calculatedAt);
 assert.equal(model.readiness,'repair');
 assert.equal(model.sources[0].state,'repair');
 assert.equal(model.criticalSources.length,1);
 assert.equal(model.primary.readySources.value,0);
});

test('missing health remains incomplete and is never silently healthy',()=>{
 const model=domain.buildConnectedOverviewModel(dashboardData([source({latest_health:null})]),calculatedAt);
 assert.equal(model.sources[0].state,'incomplete');
 assert.equal(model.readiness,'incomplete');
 assert.equal(model.primary.readySources.coverage.state,'partial');
 assert.equal(model.primary.readySources.value,0,'zero is the truthful ready count, while coverage explains missing health');
});

test('paused is not critical or attention merely because it is paused',()=>{
 const model=domain.buildConnectedOverviewModel(dashboardData([source({connection_status:'paused',latest_health:null})]),calculatedAt);
 assert.equal(model.sources[0].state,'paused');
 assert.equal(model.criticalSources.length,0);
 assert.equal(model.attentionSources.length,0);
 assert.notEqual(model.readiness,'repair');
 assert.notEqual(model.readiness,'attention');
});

test('domain facts drive critical and attention semantics without numeric direction guesses',()=>{
 const critical=source({connection_id:'c1',name:'حرج',has_error_incident:true,open_incident_count:1});
 const attention=source({connection_id:'c2',name:'متابعة',latest_health:health('degraded',{connection_id:'c2'}),latest_run:run('succeeded',{connection_id:'c2'})});
 const model=domain.buildConnectedOverviewModel(dashboardData([critical,attention]),calculatedAt);
 assert.deepEqual(model.criticalSources.map((item)=>item.id),['c1']);
 assert.deepEqual(model.attentionSources.map((item)=>item.id),['c2']);
 assert.equal(model.primary.sourcesNeedingAction.value,2);
});

test('partial fact failure never becomes zero or healthy',()=>{
 const model=domain.buildConnectedOverviewModel(dashboardData([source()],{factsFailed:true}),calculatedAt);
 assert.equal(model.isPartial,true);
 assert.equal(model.readiness,'incomplete');
 assert.equal(model.primary.readySources.value,null);
 assert.equal(model.primary.readySources.availability.state,'error');
 assert.equal(model.primary.openIssues.value,null);
 assert.equal(model.primary.openIssues.availability.state,'error');
});

test('records source failure produces Partial rather than no-data certainty',()=>{
 const model=domain.buildConnectedOverviewModel(dashboardData([source()],{recordsFailed:true}),calculatedAt);
 assert.equal(model.isPartial,true);
 assert.equal(model.hasRecords,null);
 assert.equal(model.readiness,'incomplete');
});

test('Connected metrics are Phase 4 normalized snapshot contracts',()=>{
 const model=domain.buildConnectedOverviewModel(dashboardData([source()]),calculatedAt);
 for(const metric of Object.values(model.primary)){
  assert.equal(typeof metric.metricId,'string');
  assert.equal(metric.definitionVersion,'1');
  assert.ok(metric.availability?.state);
  assert.ok(metric.coverage?.state);
  assert.ok(metric.freshness?.state);
  assert.ok(metric.provenance?.category);
  assert.ok(metric.calculatedAt);
  assert.ok(metric.period?.fromInclusive);
 }
 for(const definition of domain.connectedOverviewMetricRegistry.list()) assert.equal(definition.aggregation,'snapshot',definition.id);
});

test('latest-health and exact incident semantics are enforced by the surgical read-only RPC',async()=>{
 const migration=await read('supabase/migrations/20260816224500_connected_dashboard_facts.sql');
 assert.match(migration,/security invoker/i);
 assert.match(migration,/order by h\.captured_at desc, h\.id desc\s+limit 1/i);
 assert.match(migration,/order by r\.started_at desc, r\.id desc\s+limit 1/i);
 assert.match(migration,/count\(\*\)::integer[\s\S]*integration_health_incidents/i);
 assert.match(migration,/i\.status <> 'resolved'/);
 assert.match(migration,/grant execute[\s\S]*authenticated/i);
});

test('limited records probe is existence/latest only and no limited incident list is used as a global total',async()=>{
 const [server,component,migration]=await Promise.all([
  read('src/lib/connected/dashboard/server.ts'),
  read('components/connected/ConnectedDecisionOverview.tsx'),
  read('supabase/migrations/20260816224500_connected_dashboard_facts.sql'),
 ]);
 assert.match(server,/integration_udm_records[^\n]*order=updated_at\.desc&limit=1/);
 assert.match(server,/existence\/latest probe, never a total/);
 assert.doesNotMatch(component,/records\.data\.length|recordTypes|overview\.records\.data\.length/);
 assert.doesNotMatch(server,/integration_health_incidents[^\n]*limit=/);
 assert.match(migration,/open_incident_count/);
});

test('Connected Overview uses shared dashboard layers, no Global Date Range, no direct Recharts and no fake business KPIs',async()=>{
 const [page,component,domainSource]=await Promise.all([
  read('app/workspace/page.tsx'),
  read('components/connected/ConnectedDecisionOverview.tsx'),
  read('src/lib/connected/dashboard/domain.ts'),
 ]);
 assert.match(page,/ConnectedDecisionOverview/);
 for(const contract of ['DashboardCriticalException','DashboardStatusBlock','DashboardMetricCard','DashboardAlertBlock','DashboardDataState','DataTrustIndicator']) assert.ok(component.includes(contract),contract);
 assert.doesNotMatch(component,/DateRangeControl|DashboardFilterBar/);
 assert.doesNotMatch(component,/from ["']recharts["']/);
 assert.doesNotMatch(`${component}\n${domainSource}`,/connected\.(revenue|profit|orders)|صافي المبيعات|الربح الإجمالي|عدد الفواتير/i);
 assert.doesNotMatch(component,/\/workspace\/analytics/);
});

test('Phase 6 remains Connected-only and does not start Phase 7 scope',async()=>{
 const [page,component,server]=await Promise.all([
  read('app/workspace/page.tsx'),
  read('components/connected/ConnectedDecisionOverview.tsx'),
  read('src/lib/connected/dashboard/server.ts'),
 ]);
 assert.match(page,/nativeVisibleMetrics/,'Native implementation remains present and separate');
 assert.doesNotMatch(`${component}\n${server}`,/retail\/workspace|AdminDashboard|Founder|Phase 7/i);
});
