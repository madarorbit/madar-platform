import 'server-only';
import { platformIntegrationsConfig } from './config';

export type MadarOrganizationRelation =
  | 'can_view'
  | 'can_manage_members'
  | 'can_manage_integrations'
  | 'can_use_orby'
  | 'can_manage_billing';

export type OpenFgaCheckResult =
  | { status: 'disabled' | 'not-configured'; allowed: null }
  | { status: 'checked'; allowed: boolean }
  | { status: 'unavailable'; allowed: null; reason: string };

export type OrganizationAuthorizationResult = {
  allowed: boolean;
  source: 'madar' | 'madar+openfga';
  mode: 'disabled' | 'shadow' | 'enforce';
  openFga: OpenFgaCheckResult;
};

const headersFor = (token: string) => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
};

async function openFgaRequest(path: string, body: unknown) {
  const config = platformIntegrationsConfig().openFga;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
      headers: headersFor(config.apiToken),
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    const raw = await response.text();
    let payload: unknown = null;
    if (raw.trim()) {
      try { payload = JSON.parse(raw); } catch { payload = null; }
    }
    if (!response.ok) throw new Error(`OPENFGA_HTTP_${response.status}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkOpenFgaAuthorization(input: {
  userId: string;
  organizationId: string;
  relation: MadarOrganizationRelation;
}): Promise<OpenFgaCheckResult> {
  const config = platformIntegrationsConfig().openFga;
  if (!config.enabled) return { status: 'disabled', allowed: null };
  if (!config.configured) return { status: 'not-configured', allowed: null };
  try {
    const payload = await openFgaRequest(`/stores/${encodeURIComponent(config.storeId)}/check`, {
      tuple_key: {
        user: `user:${input.userId}`,
        relation: input.relation,
        object: `organization:${input.organizationId}`,
      },
      ...(config.authorizationModelId ? { authorization_model_id: config.authorizationModelId } : {}),
    }) as { allowed?: unknown } | null;
    if (typeof payload?.allowed !== 'boolean') throw new Error('OPENFGA_INVALID_RESPONSE');
    return { status: 'checked', allowed: payload.allowed };
  } catch (error) {
    const reason = error instanceof Error ? error.message || error.name : 'OPENFGA_UNKNOWN_ERROR';
    console.warn('OpenFGA check unavailable', { relation: input.relation, organizationId: input.organizationId, reason });
    return { status: 'unavailable', allowed: null, reason };
  }
}

/**
 * MADAR remains the primary authority. OpenFGA can only narrow an internally
 * allowed action, never grant an action that MADAR denied.
 */
export async function authorizeOrganizationAction(input: {
  internalAllowed: boolean;
  userId: string;
  organizationId: string;
  relation: MadarOrganizationRelation;
}): Promise<OrganizationAuthorizationResult> {
  const config = platformIntegrationsConfig().openFga;
  if (!input.internalAllowed) {
    return {
      allowed: false,
      source: 'madar',
      mode: config.enabled ? config.mode : 'disabled',
      openFga: { status: config.enabled ? (config.configured ? 'disabled' : 'not-configured') : 'disabled', allowed: null },
    };
  }

  const openFga = await checkOpenFgaAuthorization(input);
  if (!config.enabled) return { allowed: true, source: 'madar', mode: 'disabled', openFga };

  if (config.mode === 'shadow') {
    if (openFga.status === 'checked' && openFga.allowed !== input.internalAllowed) {
      console.warn('OpenFGA shadow authorization mismatch', {
        relation: input.relation,
        organizationId: input.organizationId,
        internalAllowed: input.internalAllowed,
        openFgaAllowed: openFga.allowed,
      });
    }
    return { allowed: true, source: 'madar', mode: 'shadow', openFga };
  }

  const allowed = openFga.status === 'checked' && openFga.allowed;
  return { allowed, source: 'madar+openfga', mode: 'enforce', openFga };
}

export async function syncOpenFgaMembership(input: {
  operation: 'add' | 'remove';
  userId: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}): Promise<{ status: 'disabled' | 'not-configured' | 'synced' | 'unavailable'; reason?: string }> {
  const config = platformIntegrationsConfig().openFga;
  if (!config.enabled) return { status: 'disabled' };
  if (!config.configured) return { status: 'not-configured' };
  const tuple = {
    user: `user:${input.userId}`,
    relation: input.role.toLowerCase(),
    object: `organization:${input.organizationId}`,
  };
  try {
    await openFgaRequest(`/stores/${encodeURIComponent(config.storeId)}/write`, input.operation === 'add'
      ? { writes: { tuple_keys: [tuple] } }
      : { deletes: { tuple_keys: [tuple] } });
    return { status: 'synced' };
  } catch (error) {
    const reason = error instanceof Error ? error.message || error.name : 'OPENFGA_UNKNOWN_ERROR';
    console.warn('OpenFGA membership synchronization unavailable; MADAR membership remains authoritative', {
      operation: input.operation,
      organizationId: input.organizationId,
      role: input.role,
      reason,
    });
    return { status: 'unavailable', reason };
  }
}
