import { randomUUID } from 'node:crypto';
import { platformIntegrationsConfig } from './config';

type UsageValue = string | number | boolean | null | undefined;

export type MadarUsageEvent = {
  id?: string;
  type: string;
  subject: string;
  time?: string;
  data: Record<string, UsageValue>;
};

export type UsageMirrorResult =
  | { status: 'disabled' | 'not-configured' }
  | { status: 'accepted' }
  | { status: 'unavailable'; reason: string };

export async function mirrorUsageEvent(event: MadarUsageEvent): Promise<UsageMirrorResult> {
  const config = platformIntegrationsConfig().openMeter;
  if (!config.enabled) return { status: 'disabled' };
  if (!config.configured) return { status: 'not-configured' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const headers = new Headers({
      'Content-Type': 'application/cloudevents+json',
      Accept: 'application/json',
    });
    if (config.apiKey) headers.set('Authorization', `Bearer ${config.apiKey}`);

    const response = await fetch(`${config.baseUrl}${config.eventsPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        specversion: '1.0',
        id: event.id || randomUUID(),
        source: 'urn:madar:platform',
        type: event.type,
        subject: event.subject,
        time: event.time || new Date().toISOString(),
        datacontenttype: 'application/json',
        data: Object.fromEntries(Object.entries(event.data).filter(([, value]) => value !== undefined)),
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('OpenMeter usage mirror rejected; MADAR quota ledger remains authoritative', {
        type: event.type,
        status: response.status,
      });
      return { status: 'unavailable', reason: `HTTP_${response.status}` };
    }
    return { status: 'accepted' };
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
    console.warn('OpenMeter usage mirror unavailable; MADAR quota ledger remains authoritative', { type: event.type, reason });
    return { status: 'unavailable', reason };
  } finally {
    clearTimeout(timeout);
  }
}

export const mirrorOrbyRequest = (input: {
  organizationId: string;
  userId: string;
  mode: string;
  source: string;
  providerId?: string | null;
  modelId?: string | null;
  inputCharacters: number;
  latencyMs: number;
}) => mirrorUsageEvent({
  type: 'orby.request',
  subject: input.organizationId,
  data: {
    requests: 1,
    user_id: input.userId,
    mode: input.mode,
    response_source: input.source,
    provider_id: input.providerId || 'fallback',
    model_id: input.modelId || 'deterministic',
    input_characters: input.inputCharacters,
    latency_ms: input.latencyMs,
  },
});

export const mirrorAgentRun = (input: { organizationId: string; userId: string; runId: string; workflowId: string }) =>
  mirrorUsageEvent({
    id: `orby-agent-${input.runId}`,
    type: 'orby.agent.run.submitted',
    subject: input.organizationId,
    data: { runs: 1, user_id: input.userId, run_id: input.runId, workflow_id: input.workflowId },
  });
