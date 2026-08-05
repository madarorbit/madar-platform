import { logger, task } from '@trigger.dev/sdk';

type WorkerKind = 'integration' | 'orby';
type DispatchPayload = { kind: WorkerKind; correlationId: string; reason?: string; requestedAt?: string };

const baseUrl = () => {
  const value = process.env.MADAR_BASE_URL?.trim().replace(/\/$/, '');
  if (!value) throw new Error('MADAR_BASE_URL is required.');
  return value;
};

const workerSecret = (kind: WorkerKind) => {
  const value = kind === 'integration'
    ? process.env.MADAR_INTEGRATION_WORKER_SECRET?.trim()
    : (process.env.MADAR_ORBY_WORKER_SECRET?.trim() || process.env.MADAR_INTEGRATION_WORKER_SECRET?.trim());
  if (!value) throw new Error(`Worker secret is not configured for ${kind}.`);
  return value;
};

async function callWorker(kind: WorkerKind) {
  const path = kind === 'integration' ? '/api/integrations/worker' : '/api/orby/agent/worker';
  const response = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${workerSecret(kind)}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MADAR-Trigger-Runtime/1.0',
    },
    body: JSON.stringify({ source: 'trigger.dev' }),
  });
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  if (raw.trim()) {
    try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = { raw: raw.slice(0, 500) }; }
  }
  if (!response.ok) throw new Error(`MADAR_${kind.toUpperCase()}_WORKER_HTTP_${response.status}`);
  return body;
}

function processedCount(kind: WorkerKind, body: Record<string, unknown>) {
  const processed = Array.isArray(body.processed) ? body.processed.length : 0;
  if (kind === 'orby') return processed;
  const writes = Array.isArray(body.writes) ? body.writes.length : 0;
  const scheduled = typeof body.scheduled === 'number' ? body.scheduled : 0;
  return processed + writes + scheduled;
}

async function drain(kind: WorkerKind, payload: DispatchPayload) {
  let total = 0;
  for (let cycle = 1; cycle <= 20; cycle += 1) {
    const body = await callWorker(kind);
    const count = processedCount(kind, body);
    total += count;
    logger.info('MADAR worker cycle completed', { kind, cycle, count, correlationId: payload.correlationId });
    if (count === 0) break;
  }
  return { ok: true, kind, total, correlationId: payload.correlationId };
}

export const madarIntegrationWorker = task({
  id: 'madar-integration-worker',
  maxDuration: 600,
  retry: { maxAttempts: 8, minTimeoutInMs: 1_000, maxTimeoutInMs: 60_000, factor: 2 },
  queue: { concurrencyLimit: 3 },
  run: async (payload: DispatchPayload) => drain('integration', payload),
});

export const madarOrbyWorker = task({
  id: 'madar-orby-worker',
  maxDuration: 600,
  retry: { maxAttempts: 8, minTimeoutInMs: 1_000, maxTimeoutInMs: 60_000, factor: 2 },
  queue: { concurrencyLimit: 3 },
  run: async (payload: DispatchPayload) => drain('orby', payload),
});
