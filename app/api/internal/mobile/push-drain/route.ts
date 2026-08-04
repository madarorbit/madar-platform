import { integrationDatabaseConfig } from '@/src/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Outbox = { id: string; organization_id: string; title: string; body: string; data: Record<string, unknown>; attempts: number };
type PushToken = { token: string };

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET || process.env.MADAR_ORBY_WORKER_SECRET || process.env.MADAR_INTEGRATION_WORKER_SECRET;
  if (!expected) return false;
  return request.headers.get('authorization') === `Bearer ${expected}`;
}

async function serviceFetch(path: string, init: RequestInit = {}) {
  const { url, serviceRoleKey } = integrationDatabaseConfig();
  const headers = new Headers(init.headers);
  headers.set('apikey', serviceRoleKey);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);
  headers.set('Content-Type', 'application/json');
  headers.set('Prefer', headers.get('Prefer') || 'return=representation');
  const response = await fetch(`${url}${path}`, { ...init, headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`PUSH_DB_${response.status}`);
  const raw = await response.text();
  return raw.trim() ? JSON.parse(raw) : null;
}

async function drain() {
  const jobs = await serviceFetch('/rest/v1/mobile_push_outbox?status=in.(pending,failed)&available_at=lte.now()&attempts=lt.5&select=id,organization_id,title,body,data,attempts&order=created_at.asc&limit=20') as Outbox[];
  let sent = 0;
  let failed = 0;
  for (const job of jobs || []) {
    await serviceFetch(`/rest/v1/mobile_push_outbox?id=eq.${job.id}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'sending', attempts: job.attempts + 1, updated_at: new Date().toISOString() }),
    });
    try {
      const tokens = await serviceFetch(`/rest/v1/mobile_push_tokens?organization_id=eq.${job.organization_id}&enabled=eq.true&select=token`) as PushToken[];
      if (!tokens?.length) {
        await serviceFetch(`/rest/v1/mobile_push_outbox?id=eq.${job.id}`, {
          method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: 'NO_ACTIVE_TOKENS' }),
        });
        continue;
      }
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(tokens.map(({ token }) => ({ to: token, title: job.title, body: job.body, data: job.data, channelId: 'madar-operations', sound: 'default' }))),
      });
      if (!response.ok) throw new Error(`EXPO_PUSH_${response.status}`);
      const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
      const ticketFailure = payload.data?.find((item) => item.status === 'error');
      if (ticketFailure) throw new Error(ticketFailure.details?.error || 'EXPO_TICKET_ERROR');
      await serviceFetch(`/rest/v1/mobile_push_outbox?id=eq.${job.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }),
      });
      sent += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      await serviceFetch(`/rest/v1/mobile_push_outbox?id=eq.${job.id}`, {
        method: 'PATCH', body: JSON.stringify({
          status: 'failed',
          available_at: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
          last_error: error instanceof Error ? error.message.slice(0, 300) : 'PUSH_FAILED',
        }),
      });
      failed += 1;
    }
  }
  return { processed: (jobs || []).length, sent, failed };
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try { return Response.json(await drain()); }
  catch (error) {
    console.error('MADAR push drain failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Push drain failed.' }, { status: 503 });
  }
}
export const POST = GET;
