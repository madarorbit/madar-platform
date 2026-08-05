import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { siteUrl } from '@/src/lib/env';
import { platformIntegrationsConfig } from './config';

export type NangoConnectSession = {
  token: string;
  connectLink: string;
  expiresAt: string;
  allowedIntegrations: string[];
};

export type NangoConnectSessionResult =
  | { status: 'disabled' | 'not-configured' }
  | { status: 'created'; session: NangoConnectSession }
  | { status: 'rejected'; reason: string };

export type NangoProxyResult =
  | { status: 'disabled' | 'not-configured' }
  | { status: 'rejected'; reason: string }
  | { status: 'completed'; ok: boolean; httpStatus: number; data: unknown; requestId: string | null };

type NangoSessionPayload = {
  data?: { token?: unknown; connect_link?: unknown; expires_at?: unknown };
  token?: unknown;
  connect_link?: unknown;
  expires_at?: unknown;
};

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};

const allowedIntegrations = (requested: string[] | undefined, configured: string[]) => {
  const configuredSet = new Set(configured);
  const candidates = requested?.length ? requested : configured;
  return [...new Set(candidates.map((item) => item.trim()).filter((item) => configuredSet.has(item)))].slice(0, 20);
};

export async function createNangoConnectSession(input: {
  organizationId: string;
  organizationName: string;
  userId: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
  requestedIntegrations?: string[];
}): Promise<NangoConnectSessionResult> {
  const config = platformIntegrationsConfig().nango;
  if (!config.enabled) return { status: 'disabled' };
  if (!config.configured) return { status: 'not-configured' };
  const integrations = allowedIntegrations(input.requestedIntegrations, config.allowedIntegrations);
  if (!config.allowedIntegrations.length) return { status: 'rejected', reason: 'NANGO_ALLOWLIST_EMPTY' };
  if (!integrations.length) return { status: 'rejected', reason: 'NANGO_INTEGRATION_NOT_ALLOWED' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.apiUrl}/connect/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        allowed_integrations: integrations,
        end_user: {
          id: input.userId,
          ...(input.userEmail ? { email: input.userEmail } : {}),
          ...(input.userDisplayName ? { display_name: input.userDisplayName } : {}),
        },
        organization: { id: input.organizationId, display_name: input.organizationName },
        tags: { end_user_id: input.userId, organization_id: input.organizationId, platform: 'madar' },
        webhook_url_override: `${siteUrl()}/api/integrations/nango/webhook`,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const raw = await response.text();
    let payload: NangoSessionPayload | null = null;
    if (raw.trim()) {
      try { payload = JSON.parse(raw) as NangoSessionPayload; } catch { payload = null; }
    }
    if (!response.ok) return { status: 'rejected', reason: `NANGO_HTTP_${response.status}` };
    const data: NangoSessionPayload | null = payload?.data ?? payload;
    if (!data || typeof data.token !== 'string' || typeof data.connect_link !== 'string' || typeof data.expires_at !== 'string') {
      return { status: 'rejected', reason: 'NANGO_INVALID_RESPONSE' };
    }
    return {
      status: 'created',
      session: { token: data.token, connectLink: data.connect_link, expiresAt: data.expires_at, allowedIntegrations: integrations },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message || error.name : 'NANGO_UNKNOWN_ERROR';
    console.warn('Nango connect session unavailable; MADAR integration engine is not affected', {
      organizationId: input.organizationId,
      reason,
    });
    return { status: 'rejected', reason };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Restricted server-only proxy for certified MADAR connectors. It cannot
 * override Nango's API base URL, integration allowlist, or credential headers.
 */
export async function nangoProxyRequest(input: {
  integrationId: string;
  connectionId: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
}): Promise<NangoProxyResult> {
  const config = platformIntegrationsConfig().nango;
  if (!config.enabled) return { status: 'disabled' };
  if (!config.configured) return { status: 'not-configured' };
  if (!config.allowedIntegrations.includes(input.integrationId)) return { status: 'rejected', reason: 'NANGO_INTEGRATION_NOT_ALLOWED' };
  if (!input.connectionId.trim() || input.connectionId.length > 300) return { status: 'rejected', reason: 'NANGO_CONNECTION_INVALID' };
  if (!input.endpoint.startsWith('/') || input.endpoint.startsWith('//') || input.endpoint.includes('..') || input.endpoint.includes('\\') || /[\r\n]/.test(input.endpoint) || input.endpoint.length > 1_000) {
    return { status: 'rejected', reason: 'NANGO_ENDPOINT_INVALID' };
  }
  const method = input.method || 'GET';
  let body: string | undefined;
  if (input.data !== undefined) {
    try { body = JSON.stringify(input.data); } catch { return { status: 'rejected', reason: 'NANGO_BODY_INVALID' }; }
    if (Buffer.byteLength(body, 'utf8') > 262_144) return { status: 'rejected', reason: 'NANGO_BODY_TOO_LARGE' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(config.timeoutMs, 10_000));
  try {
    const response = await fetch(`${config.apiUrl}/proxy${input.endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Provider-Config-Key': input.integrationId,
        'Connection-Id': input.connectionId,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      signal: controller.signal,
      cache: 'no-store',
    });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 5 * 1024 * 1024) return { status: 'rejected', reason: 'NANGO_RESPONSE_TOO_LARGE' };
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > 5 * 1024 * 1024) return { status: 'rejected', reason: 'NANGO_RESPONSE_TOO_LARGE' };
    let data: unknown = raw;
    if (raw.trim()) {
      try { data = JSON.parse(raw); } catch { data = raw.slice(0, 20_000); }
    } else data = null;
    return {
      status: 'completed',
      ok: response.ok,
      httpStatus: response.status,
      data,
      requestId: response.headers.get('x-request-id') || response.headers.get('nango-request-id'),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message || error.name : 'NANGO_PROXY_UNKNOWN_ERROR';
    return { status: 'rejected', reason };
  } finally {
    clearTimeout(timeout);
  }
}

export function verifyNangoWebhook(rawBody: string, suppliedSignature: string | null) {
  const config = platformIntegrationsConfig().nango;
  if (!config.enabled || !config.webhookConfigured || !suppliedSignature) return false;
  const expected = createHmac('sha256', config.webhookSigningKey).update(rawBody, 'utf8').digest('hex');
  return safeEqual(expected, suppliedSignature.trim().toLowerCase());
}

export function sanitizeNangoWebhookTags(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>;
  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of ['organization_id', 'end_user_id', 'platform']) {
    const item = source[key];
    if (typeof item === 'string' && item.length <= 200) result[key] = item;
  }
  return result;
}
