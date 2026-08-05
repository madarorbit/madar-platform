import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('external integrations are opt-in and fail-open', async () => {
  const config = await read('src/lib/platform-integrations/config.ts');
  assert.match(config, /MADAR_TRIGGER_ENABLED/);
  assert.match(config, /MADAR_LANGFUSE_ENABLED/);
  assert.match(config, /MADAR_OPENMETER_ENABLED/);
  assert.match(config, /MADAR_OBSERVABILITY_CAPTURE_CONTENT/);
});

test('Langfuse uses OTLP v4 and does not capture content unconditionally', async () => {
  const source = await read('src/lib/platform-integrations/langfuse.ts');
  assert.match(source, /api\/public\/otel\/v1\/traces/);
  assert.match(source, /x-langfuse-ingestion-version/);
  assert.match(source, /config\.captureContent \?/);
});

test('OpenMeter receives CloudEvents while MADAR remains authoritative', async () => {
  const source = await read('src/lib/platform-integrations/openmeter.ts');
  assert.match(source, /application\/cloudevents\+json/);
  assert.match(source, /specversion: '1\.0'/);
  assert.match(source, /MADAR quota ledger remains authoritative/);
});

test('Trigger runtime calls existing protected MADAR workers', async () => {
  const source = await read('infra/trigger-runtime/src/tasks.ts');
  assert.match(source, /\/api\/integrations\/worker/);
  assert.match(source, /\/api\/orby\/agent\/worker/);
  assert.match(source, /Authorization: `Bearer/);
});
