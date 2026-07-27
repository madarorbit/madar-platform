import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('reference commerce fixture covers historical incremental duplicate invalid missing and recovery scenarios',async()=>{
 const [fixture,connector]=await Promise.all([read('src/lib/integration/lab/fixtures.ts'),read('src/lib/integration/connectors/reference-commerce.ts')]);
 for(const stream of ['products','customers','orders','order_items','payments','inventory'])assert.match(fixture,new RegExp(`'${stream}'`));
 assert.match(fixture,/includeDuplicates/);assert.match(fixture,/includeInvalid/);assert.match(fixture,/includeMissing/);assert.match(fixture,/incrementalLabData/);
 assert.match(connector,/failAfterBatch/);assert.match(connector,/disconnectAfterBatch/);assert.match(connector,/SOURCE_UNAVAILABLE/);assert.match(connector,/context\.checkpoints/);assert.match(connector,/madar-lab-key-v/);
 assert.doesNotMatch(connector,/write:true/);
});

test('technical connector laboratory includes REST webhook CSV Excel read-only database Local Bridge and OAuth',async()=>{
 const technical=await read('src/lib/integration/connectors/readiness-technical.ts');
 for(const key of ['madar-test-rest','madar-test-webhook','madar-test-csv-excel','madar-test-database-readonly','madar-test-local-bridge','madar-test-oauth'])assert.match(technical,new RegExp(key));
 assert.match(technical,/parseCsvLine/);assert.match(technical,/SpreadsheetML/);assert.match(technical,/assertReadOnlySql/);assert.match(technical,/oauthTokenExpiresSoon/);assert.match(technical,/disconnectAfterBatch/);
 assert.match(technical,/capabilities:\{read:true,write:false/);
 assert.doesNotMatch(technical,/eval\(|new Function\(/);
});

test('acceptance runner enforces all gates before a real customer connection',async()=>{
 const runner=await read('src/lib/integration/lab/readiness-runner.ts');
 for(const key of ['workspace-isolation','secret-encryption','historical-sync','incremental-sync','resume-after-failure','deduplication','udm-quality-isolation','technical-connectors','key-and-oauth-expiry','read-only','connection-observability','audit-trail','connector-extensibility'])assert.match(runner,new RegExp(`'${key}'`));
 assert.match(runner,/integration_readiness_lab_enabled/);assert.match(runner,/integration_readiness_runs/);assert.match(runner,/integration_readiness_checks/);assert.match(runner,/integration\.readiness\.completed/);
 assert.match(runner,/new ConnectorRegistry\(\)/);assert.match(runner,/registry\.register/);
});

test('readiness database schema is isolated service-only and disabled by default',async()=>{
 const migration=await read('supabase/migrations/20260728223000_integration_readiness_lab.sql');
 assert.match(migration,/integration_readiness_lab_enabled',false/);
 assert.match(migration,/create table if not exists public\.integration_readiness_runs/i);
 assert.match(migration,/create table if not exists public\.integration_readiness_checks/i);
 assert.match(migration,/enable row level security/gi);
 assert.match(migration,/revoke all on public\.integration_readiness_runs,public\.integration_readiness_checks from anon,authenticated/i);
 assert.match(migration,/grant select,insert,update,delete on public\.integration_readiness_runs,public\.integration_readiness_checks to service_role/i);
 for(const connector of ['madar-reference-commerce','madar-test-rest','madar-test-webhook','madar-test-csv-excel','madar-test-database-readonly','madar-test-local-bridge','madar-test-oauth'])assert.match(migration,new RegExp(connector));
});

test('runtime and admin expose the lab without replacing the core connector registry',async()=>{
 const [runtime,page,shell,actions]=await Promise.all([read('src/lib/integration/runtime.ts'),read('app/admin/integrations/readiness/page.tsx'),read('components/admin/EnterpriseAdminShell.tsx'),read('app/admin/integrations/readiness/actions.ts')]);
 assert.match(runtime,/new ConnectorRegistry\(\[diagnosticConnector\]\)/);assert.match(runtime,/registry\.register\(referenceCommerceConnector\)/);assert.match(runtime,/readinessTechnicalConnectors/);
 assert.match(page,/runIntegrationReadinessLab/);assert.match(page,/integration_readiness_lab_enabled/);assert.match(page,/القراءة فقط/);assert.match(shell,/\/admin\/integrations\/readiness/);
 assert.match(actions,/requireSuperAdmin/);assert.match(actions,/IntegrationReadinessLab/);
});
