import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { IntegrationDatabase } from '@/src/lib/integration/platform';
import { platformIntegrationsConfig, publishOrganizationWebhook, sanitizeNangoWebhookTags, verifyNangoWebhook } from '@/src/lib/platform-integrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 200) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : '';

export async function POST(request: Request) {
  const config = platformIntegrationsConfig().nango;
  if (!config.enabled || !config.webhookConfigured) return Response.json({ ok: false, error: 'ENDPOINT_NOT_FOUND' }, { status: 404 });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 262_144) return Response.json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 262_144) return Response.json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  if (!verifyNangoWebhook(raw, request.headers.get('x-nango-hmac-sha256'))) {
    return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw) as Record<string, unknown>; }
  catch { return Response.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 }); }

  const webhookType = text(payload.type, 80);
  const operation = text(payload.operation, 80);
  if (webhookType !== 'auth' || !['creation', 'override'].includes(operation)) {
    return Response.json({ ok: true, ignored: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }

  const tags = sanitizeNangoWebhookTags(payload.tags);
  const organizationId = tags.organization_id || '';
  const actorId = tags.end_user_id || '';
  const connectionId = text(payload.connectionId ?? payload.connection_id, 300);
  const providerConfigKey = text(payload.providerConfigKey ?? payload.provider_config_key, 200);
  const provider = text(payload.provider, 120);
  const authMode = text(payload.authMode ?? payload.auth_mode, 80);
  const environment = text(payload.environment, 80);
  const success = payload.success !== false;
  if (!uuid.test(organizationId) || !uuid.test(actorId) || !connectionId || !providerConfigKey) {
    return Response.json({ ok: false, error: 'BINDING_CONTEXT_INVALID' }, { status: 422 });
  }

  const database = new IntegrationDatabase();
  const [organization, membership] = await Promise.all([
    database.select<{ id: string; name: string; status: string }>('organizations', new URLSearchParams({
      select: 'id,name,status', id: `eq.${organizationId}`, status: 'eq.active', limit: '1',
    })),
    database.select<{ role: string }>('organization_members', new URLSearchParams({
      select: 'role', organization_id: `eq.${organizationId}`, user_id: `eq.${actorId}`, limit: '1',
    })),
  ]);
  if (!organization[0] || !membership[0]) return Response.json({ ok: false, error: 'BINDING_CONTEXT_REJECTED' }, { status: 403 });

  const now = new Date().toISOString();
  await database.upsert('platform_external_bindings', {
    organization_id: organizationId,
    provider: 'nango',
    external_key: providerConfigKey,
    external_id: connectionId,
    status: success ? 'active' : 'error',
    metadata: {
      provider,
      auth_mode: authMode,
      environment,
      operation,
      tags,
      managed_credentials: true,
    },
    created_by: actorId,
    updated_at: now,
  }, 'provider,external_id');

  const deliveryId = createHash('sha256').update(raw).digest('hex');
  await database.insert('audit_logs', {
    actor_id: actorId,
    action: success ? 'integration.nango.connection_authorized' : 'integration.nango.connection_failed',
    entity_type: 'external_integration_binding',
    entity_id: connectionId,
    metadata: {
      organization_id: organizationId,
      provider: 'nango',
      provider_config_key: providerConfigKey,
      operation,
      delivery_id: deliveryId,
    },
  }, 'return=minimal').catch(() => undefined);

  after(async () => {
    await publishOrganizationWebhook({
      organizationId,
      organizationName: organization[0].name,
      eventType: success ? 'integration.connection.authorized' : 'integration.connection.failed',
      eventId: `nango-${deliveryId}`,
      payload: {
        binding_provider: 'nango',
        integration_key: providerConfigKey,
        external_connection_id: connectionId,
        provider,
        operation,
        success,
      },
      channels: ['integrations'],
    });
  });

  return Response.json({ ok: true, accepted: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
