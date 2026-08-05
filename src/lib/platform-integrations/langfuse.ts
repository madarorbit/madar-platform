import { randomBytes } from 'node:crypto';
import { platformIntegrationsConfig } from './config';

type AttributeValue = string | number | boolean | null | undefined;

type OrbyObservation = {
  name: string;
  organizationId: string;
  userId: string;
  sessionId?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  mode?: string | null;
  source: string;
  startedAtMs: number;
  endedAtMs?: number;
  input?: string;
  output?: string;
  errorCode?: string | null;
  metadata?: Record<string, AttributeValue>;
};

export type ObservationExportResult =
  | { status: 'disabled' | 'not-configured' }
  | { status: 'accepted'; traceId: string }
  | { status: 'unavailable'; reason: string };

const otlpValue = (value: Exclude<AttributeValue, null | undefined>) => {
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  return { stringValue: value };
};

const attributes = (values: Record<string, AttributeValue>) => Object.entries(values)
  .filter(([, value]) => value !== null && value !== undefined)
  .map(([key, value]) => ({ key, value: otlpValue(value as Exclude<AttributeValue, null | undefined>) }));

const unixNano = (milliseconds: number) => String(BigInt(Math.max(0, Math.floor(milliseconds))) * 1_000_000n);
const hex = (bytes: number) => randomBytes(bytes).toString('hex');
const clipped = (value: string | undefined) => value ? value.slice(0, 16_000) : undefined;

export async function exportOrbyObservation(input: OrbyObservation): Promise<ObservationExportResult> {
  const config = platformIntegrationsConfig().langfuse;
  if (!config.enabled) return { status: 'disabled' };
  if (!config.configured) return { status: 'not-configured' };

  const traceId = hex(16);
  const spanId = hex(8);
  const endedAtMs = input.endedAtMs || Date.now();
  const contentAttributes = config.captureContent ? {
    'gen_ai.input.messages': JSON.stringify([{ role: 'user', content: clipped(input.input) }]),
    'gen_ai.output.messages': JSON.stringify([{ role: 'assistant', content: clipped(input.output) }]),
  } : {};

  const payload = {
    resourceSpans: [{
      resource: {
        attributes: attributes({
          'service.name': 'madar-platform',
          'service.namespace': 'madar',
          'deployment.environment.name': process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        }),
      },
      scopeSpans: [{
        scope: { name: 'madar.orby', version: '1' },
        spans: [{
          traceId,
          spanId,
          name: input.name,
          kind: 1,
          startTimeUnixNano: unixNano(input.startedAtMs),
          endTimeUnixNano: unixNano(endedAtMs),
          attributes: attributes({
            'gen_ai.operation.name': 'chat',
            'gen_ai.provider.name': input.providerId || 'madar-fallback',
            'gen_ai.request.model': input.modelId || 'deterministic',
            'gen_ai.response.model': input.modelId || 'deterministic',
            'langfuse.trace.name': input.name,
            'langfuse.user.id': input.userId,
            'langfuse.session.id': input.sessionId || input.organizationId,
            'madar.organization.id': input.organizationId,
            'madar.orby.mode': input.mode,
            'madar.response.source': input.source,
            'madar.content.captured': config.captureContent,
            ...contentAttributes,
            ...input.metadata,
          }),
          status: input.errorCode
            ? { code: 2, message: input.errorCode }
            : { code: 1 },
        }],
      }],
    }],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`, 'utf8').toString('base64');
    const response = await fetch(`${config.baseUrl}/api/public/otel/v1/traces`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'x-langfuse-ingestion-version': '4',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      console.warn('Langfuse observation rejected; ORBY execution is not affected', { status: response.status, name: input.name });
      return { status: 'unavailable', reason: `HTTP_${response.status}` };
    }
    return { status: 'accepted', traceId };
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
    console.warn('Langfuse observation unavailable; ORBY execution is not affected', { reason, name: input.name });
    return { status: 'unavailable', reason };
  } finally {
    clearTimeout(timeout);
  }
}
