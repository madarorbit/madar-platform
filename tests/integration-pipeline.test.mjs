import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('UDM declares every approved canonical entity and keeps calculations in MADAR code',async()=>{
 const udm=await read('src/lib/integration/udm.ts');
 for(const entity of ['organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event'])assert.match(udm,new RegExp(`'${entity}'`));
 assert.match(udm,/validateAndNormalize/);
 assert.match(udm,/normalizeCurrency/);
 assert.match(udm,/normalizeUnit/);
 assert.match(udm,/identityParts/);
 assert.doesNotMatch(udm,/ORBY|Gemini|OpenAI|language model/i);
});

test('raw batches flow through validation mapping deduplication and unified storage',async()=>{
 const [pipeline,sync,runtime]=await Promise.all([read('src/lib/integration/pipeline.ts'),read('src/lib/integration/sync-engine.ts'),read('src/lib/integration/runtime.ts')]);
 assert.match(sync,/pipeline\.process_batch/);
 assert.match(sync,/raw_batch_id/);
 assert.match(pipeline,/integration_pipeline_records/);
 assert.match(pipeline,/integration_upsert_udm_record/);
 assert.match(pipeline,/integration_match_candidates/);
 assert.match(pipeline,/integration_quality_issues/);
 assert.match(pipeline,/integration_health_snapshots/);
 assert.match(pipeline,/integration_audit_events/);
 assert.match(runtime,/new DataPipelineEngine/);
});

test('database migration provides lineage quality health foreign keys and guarded admin RPCs',async()=>{
 const migration=await read('supabase/migrations/20260728003000_udm_quality_observability.sql');
 for(const table of ['integration_mapping_rules','integration_validation_rules','integration_pipeline_runs','integration_pipeline_records','integration_udm_records','integration_udm_source_keys','integration_udm_relations','integration_match_candidates','integration_quality_issues','integration_health_snapshots','integration_audit_events'])assert.match(migration,new RegExp(`create table if not exists public\\.${table}`,'i'));
 assert.match(migration,/Source → Raw → Validate → Transform → Map → Deduplicate → Unified/);
 assert.match(migration,/integration_pipeline_enabled',false/);
 assert.match(migration,/integration_quality_center_enabled',false/);
 assert.match(migration,/private\.is_admin\(\)/);
 assert.match(migration,/enable row level security/gi);
 assert.match(migration,/^grant execute on function public\.integration_upsert_udm_record[^\n]* to service_role;$/m);
 assert.doesNotMatch(migration,/^grant execute on function public\.integration_upsert_udm_record[^\n]*authenticated[^\n]*;$/m);
});

test('admin center exposes connection operations, quality issues, mapping and health without touching store features',async()=>{
 const [page,actions,shell]=await Promise.all([read('app/admin/integrations/page.tsx'),read('app/admin/integrations/actions.ts'),read('components/admin/EnterpriseAdminShell.tsx')]);
 assert.match(page,/integration_quality_dashboard/);
 assert.match(page,/integration_health_snapshots/);
 assert.match(page,/integration_quality_issues/);
 assert.match(page,/integration_mapping_rules/);
 assert.match(actions,/integration_admin_enqueue_sync/);
 assert.match(actions,/integration_admin_backfill_raw_batches/);
 assert.match(shell,/\/admin\/integrations/);
 assert.doesNotMatch(page,/products|store_settings|orders\?/i);
});
