import 'server-only';
import { createHash } from 'node:crypto';
import { platformIntegrationsConfig } from './config';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export type SvixPublishResult =
  | { status: 'disabled' | 'not-configured' }
  | { status: 'accepted'; messageId: string | null; applicationId: string }
  | { status: 'duplicate'; applicationId: string }
  | { status: 'rejected'; reason: string };

const applicationUid = (organizationId: string) => `madar-org-${organizationId}`;
const idempotency = (value: string) => createHash('sha256').update(value).digest('hex');

async function svixRequest(path: string, init: RequestInit) {
  const config = platformIntegrationsConfig().svix;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    return await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...Object.fromEntries(new Headers(init.headers).entries()),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureOrganizationApplication(input: { organizationId: string; organizationName?: string }) {
  const uid = applicationUid(input.organizationId);
  const response = await svixRequest('/api/v1/app?get_if_exists=true', {
    method: 'POST',
    headers: { 'idempotency-key': idempotency(`svix-application:${uid}`) },
    body: JSON.stringify({
      name: input.organizationName?.trim() || `مَدار — ${input.organizationId.slice(0, 8)}`,
      uid,
      metadata: { organization_id: input.organizationId, platform: 'madar' },
    }),
  });
  const raw = await response.text();
  let payload: { id?: unknown } | null = null;
  if (raw.trim()) {
    try { payload = JSON.parse(raw) as { id?: unknown }; } catch { payload = null; }
  }
  if (!response.ok || typeof payload?.id !== 'string') throw new Error(`SVIX_APPLICATION_HTTP_${response.status}`);
  return payload.id;
}

export async function publishOrganizationWebhook(input: {
  organizationId: string;
  organizationName?: string;
  eventType: string;
  eventId: string;
  payload: JsonObject;
  channels?: string[];
}): Promise<SvixPublishResult> {
  const config = platformIntegrationsConfig().svix;
  if (!config.enabled) return { status: 'disabled' };
  if (!config.configured) return { status: 'not-configured' };
  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/i.test(input.eventType)) return { status: 'rejected', reason: 'EVENT_TYPE_INVALID' };

  const eventPayload: JsonObject = {
    schema_version: 1,
    organization_id: input.organizationId,
    occurred_at: new Date().toISOString(),
    ...input.payload,
  };
  let serialized: string;
  try { serialized = JSON.stringify(eventPayload); } catch { return { status: 'rejected', reason: 'PAYLOAD_NOT_SERIALIZABLE' }; }
  if (Buffer.byteLength(serialized, 'utf8') > config.maxPayloadBytes) {
    return { status: 'rejected', reason: 'PAYLOAD_TOO_LARGE' };
  }

  try {
    const appId = await ensureOrganizationApplication(input);
    const response = await svixRequest(`/api/v1/app/${encodeURIComponent(appId)}/msg?with_content=false`, {
      method: 'POST',
      headers: { 'idempotency-key': idempotency(`svix-message:${input.organizationId}:${input.eventId}`) },
      body: JSON.stringify({
        eventId: input.eventId,
        eventType: input.eventType,
        payload: eventPayload,
        channels: input.channels?.slice(0, 20),
        tags: ['madar', `organization:${input.organizationId}`],
      }),
    });
    if (response.status === 409) return { status: 'duplicate', applicationId: appId };
    const raw = await response.text();
    let payload: { id?: unknown } | null = null;
    if (raw.trim()) {
      try { payload = JSON.parse(raw) as { id?: unknown }; } catch { payload = null; }
    }
    if (!response.ok) throw new Error(`SVIX_MESSAGE_HTTP_${response.status}`);
    return { status: 'accepted', messageId: typeof payload?.id === 'string' ? payload.id : null, applicationId: appId };
  } catch (error) {
    const reason = error instanceof Error ? error.message || error.name : 'SVIX_UNKNOWN_ERROR';
    console.warn('Svix delivery unavailable; MADAR operation is not affected', {
      organizationId: input.organizationId,
      eventType: input.eventType,
      reason,
    });
    return { status: 'rejected', reason };
  }
}
