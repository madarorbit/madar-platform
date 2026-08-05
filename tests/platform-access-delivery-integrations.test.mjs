import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('OpenFGA, Svix, and Nango are opt-in with OpenFGA shadow by default', async () => {
  const config = await read('src/lib/platform-integrations/config.ts');
  const env = await read('.env.example');
  assert.match(config, /MADAR_OPENFGA_ENABLED/);
  assert.match(config, /MADAR_SVIX_ENABLED/);
  assert.match(config, /MADAR_NANGO_ENABLED/);
  assert.match(env, /MADAR_OPENFGA_MODE=shadow/);
  assert.match(env, /MADAR_OPENFGA_ENABLED=false/);
  assert.match(env, /MADAR_SVIX_ENABLED=false/);
  assert.match(env, /MADAR_NANGO_ENABLED=false/);
});

test('OpenFGA never grants an action denied by MADAR and supports shadow rollout', async () => {
  const source = await read('src/lib/platform-integrations/openfga.ts');
  assert.match(source, /if \(!input\.internalAllowed\)/);
  assert.match(source, /config\.mode === 'shadow'/);
  assert.match(source, /madar\+openfga/);
  assert.match(source, /OpenFGA shadow authorization mismatch/);
  const model = await read('infra/openfga/model.fga');
  assert.match(model, /define can_manage_integrations: owner or admin/);
  assert.match(model, /define can_manage_billing: owner/);
});

test('Svix isolates every organization and limits outbound webhook payloads', async () => {
  const source = await read('src/lib/platform-integrations/svix.ts');
  const config = await read('src/lib/platform-integrations/config.ts');
  assert.match(source, /madar-org-\$\{organizationId\}/);
  assert.match(source, /get_if_exists=true/);
  assert.match(config, /maxPayloadBytes: 40 \* 1024/);
  assert.match(source, /organization_id: input\.organizationId/);
  assert.match(source, /idempotency-key/);
});

test('Nango uses allowlisted short-lived connect sessions and signed webhook reconciliation', async () => {
  const adapter = await read('src/lib/platform-integrations/nango.ts');
  const connectRoute = await read('app/api/integrations/nango/connect-session/route.ts');
  const webhookRoute = await read('app/api/integrations/nango/webhook/route.ts');
  assert.match(adapter, /\/connect\/sessions/);
  assert.match(adapter, /allowedIntegrations/);
  assert.match(adapter, /NANGO_INTEGRATION_NOT_ALLOWED/);
  assert.match(adapter, /\/proxy\$\{input\.endpoint\}/);
  assert.match(connectRoute, /can_manage_integrations/);
  assert.match(webhookRoute, /x-nango-hmac-sha256/);
  assert.match(webhookRoute, /platform_external_bindings/);
});

test('external bindings store references only and expose strictly read-only tenant access', async () => {
  const [migration, hardening, optimization] = await Promise.all([
    read('supabase/migrations/20260805235500_platform_external_bindings.sql'),
    read('supabase/migrations/20260806092500_harden_platform_external_bindings_grants.sql'),
    read('supabase/migrations/20260806093500_optimize_platform_external_bindings.sql'),
  ]);
  assert.match(migration, /external_id text not null/);
  assert.match(migration, /metadata jsonb/);
  assert.doesNotMatch(migration, /access_token|refresh_token|client_secret/i);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /organization_members/);
  assert.match(hardening, /revoke all privileges.*authenticated/);
  assert.match(hardening, /grant select.*authenticated/);
  assert.doesNotMatch(hardening, /grant (insert|update|delete|truncate).*authenticated/i);
  assert.match(optimization, /platform_external_bindings_created_by_idx/);
  assert.match(optimization, /\(select auth\.uid\(\)\)/);
});

test('Svix receives only operational metadata from ORBY and inbound integration routes', async () => {
  const orby = await read('app/api/orby/agent/runs/route.ts');
  const inbound = await read('app/api/integrations/inbound/[endpointId]/route.ts');
  assert.match(orby, /orby\.agent\.run\.submitted/);
  assert.doesNotMatch(orby, /payload:\{[^}]*goal/s);
  assert.match(inbound, /integration\.batch\.received/);
  assert.match(inbound, /records: batchRecords\.length/);
  assert.doesNotMatch(inbound, /publishOrganizationWebhook\([\s\S]*records: batchRecords as never/);
});
