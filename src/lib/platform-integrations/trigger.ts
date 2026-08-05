import { randomUUID } from 'node:crypto';
import { platformIntegrationsConfig, type DurableWorkerKind } from './config';

export type DurableDispatchResult =
  | { status: 'disabled' | 'not-configured' }
  | { status: 'accepted'; runId: string | null }
  | { status: 'unavailable'; reason: string };

export async function dispatchDurableWorker(input: {
  kind: DurableWorkerKind;
  correlationId?: string;
  reason?: string;
}): Promise<DurableDispatchResult> {
  const config = platformIntegrationsConfig().trigger;
  if (!config.enabled) return { status: 'disabled' };
  if (!config.configured) return { status: 'not-configured' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const taskId = config.tasks[input.kind];
    const response = await fetch(`${config.apiUrl}/api/v1/tasks/${encodeURIComponent(taskId)}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: {
          kind: input.kind,
          correlationId: input.correlationId || randomUUID(),
          reason: input.reason || 'madar-platform-dispatch',
          requestedAt: new Date().toISOString(),
        },
        context: { source: 'madar-platform', schemaVersion: 1 },
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    const raw = await response.text();
    let body: { id?: unknown } | null = null;
    if (raw.trim()) {
      try { body = JSON.parse(raw) as { id?: unknown }; } catch { body = null; }
    }
    if (!response.ok) {
      console.warn('Trigger.dev dispatch rejected', { kind: input.kind, status: response.status });
      return { status: 'unavailable', reason: `HTTP_${response.status}` };
    }
    return { status: 'accepted', runId: typeof body?.id === 'string' ? body.id : null };
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
    console.warn('Trigger.dev dispatch unavailable; MADAR internal workers remain authoritative', { kind: input.kind, reason });
    return { status: 'unavailable', reason };
  } finally {
    clearTimeout(timeout);
  }
}
