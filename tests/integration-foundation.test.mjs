import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('connector SDK is isolated behind a versioned compile-time registry',async()=>{
 const [contracts,registry,runtime]=await Promise.all([read('src/lib/integration/contracts.ts'),read('src/lib/integration/registry.ts'),read('src/lib/integration/runtime.ts')]);
 assert.match(contracts,/export interface Connector/);
 assert.match(contracts,/initialSync\(context:ConnectorContext/);
 assert.match(contracts,/incrementalSync\(context:ConnectorContext/);
 assert.match(registry,/private readonly connectors=new Map/);
 assert.match(registry,/VERSION_PATTERN/);
 assert.match(runtime,/new ConnectorRegistry\(\[diagnosticConnector\]\)/);
 assert.doesNotMatch(runtime,/eval\(|new Function\(/);
});

test('authentication strategies keep secrets server-side and support common schemes',async()=>{
 const [auth,env,route]=await Promise.all([read('src/lib/integration/auth.ts'),read('src/lib/env.ts'),read('app/api/integrations/worker/route.ts')]);
 for(const scheme of ['api_key','bearer','basic','oauth2','database','custom'])assert.match(auth,new RegExp(`${scheme}:`));
 assert.match(env,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(env,/MADAR_INTEGRATION_MASTER_KEY/);
 assert.match(route,/timingSafeEqual/);
 assert.doesNotMatch(route,/NEXT_PUBLIC_.*SERVICE_ROLE/);
});

test('queue and sync engine provide leases, backoff, checkpoints and idempotency',async()=>{
 const [platform,engine,errors,migration]=await Promise.all([read('src/lib/integration/platform.ts'),read('src/lib/integration/sync-engine.ts'),read('src/lib/integration/errors.ts'),read('supabase/migrations/20260727213000_integration_foundation_core.sql')]);
 assert.match(platform,/integration_claim_jobs/);
 assert.match(platform,/integration_sync_checkpoints/);
 assert.match(engine,/batchHash/);
 assert.match(engine,/heartbeat/);
 assert.match(engine,/checkpoints\.save/);
 assert.match(errors,/computeBackoffMs/);
 assert.match(migration,/for update skip locked/i);
 assert.match(migration,/integration_jobs_idempotency_idx/);
 assert.match(migration,/lease_expires_at/);
 assert.match(migration,/unique\(connection_id,stream_key\)/i);
});

test('tenant isolation and secret denial are explicit in the migration',async()=>{
 const migration=await read('supabase/migrations/20260727213000_integration_foundation_core.sql');
 assert.match(migration,/private\.is_organization_member\(organization_id\)/);
 assert.match(migration,/private\.has_organization_role\(target_organization/);
 assert.match(migration,/alter table public\.integration_connection_secrets enable row level security/i);
 assert.doesNotMatch(migration,/policy .*integration_connection_secrets/i);
 assert.match(migration,/revoke all on public\.integration_connectors,public\.integration_connections,public\.integration_connection_secrets/i);
 assert.match(migration,/grant execute on function public\.integration_claim_jobs.*to service_role/i);
});

test('connection secret rotation is atomic and serialized per connection',async()=>{
 const [manager,migration]=await Promise.all([read('src/lib/integration/connection-manager.ts'),read('supabase/migrations/20260727215500_integration_secret_rotation_rpc.sql')]);
 assert.match(manager,/integration_rotate_connection_secret/);
 assert.doesNotMatch(manager,/insert<\{id:string\}>\('integration_connection_secrets'.*rotation:true/s);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/update public\.integration_connection_secrets[\s\S]*insert into public\.integration_connection_secrets/i);
 assert.match(migration,/grant execute on function public\.integration_rotate_connection_secret.*to service_role/i);
});

test('write operations remain disabled by feature flag and read-only defaults',async()=>{
 const [migration,contracts,manager]=await Promise.all([read('supabase/migrations/20260727213000_integration_foundation_core.sql'),read('src/lib/integration/contracts.ts'),read('src/lib/integration/connection-manager.ts')]);
 assert.match(migration,/integration_write_enabled',false/);
 assert.match(migration,/connection_mode text not null default 'READ_ONLY'/);
 assert.match(contracts,/ConnectionMode='READ_ONLY'\|'WRITE_LIMITED'/);
 assert.match(manager,/connection\.status!=='active'/);
});
