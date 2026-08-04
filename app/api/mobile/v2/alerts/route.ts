import { mobileContext, mobileError, nextCursor, pageOffset, rows } from '@/src/lib/mobile/v2';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const context = await mobileContext(request);
    const offset = pageOffset(new URL(request.url).searchParams.get('cursor'));
    const [insightsData, statesData] = await Promise.all([
      supabaseFetch(`/rest/v1/orby_insights?organization_id=eq.${encodeURIComponent(context.workspaceId)}&status=eq.active&select=id,severity,title,body,generated_at&order=generated_at.desc,id.desc&limit=${PAGE_SIZE + 1}&offset=${offset}`, {}, context.accessToken),
      supabaseFetch(`/rest/v1/mobile_alert_states?organization_id=eq.${encodeURIComponent(context.workspaceId)}&user_id=eq.${encodeURIComponent(context.user.id)}&select=alert_id,acknowledged_at,hidden_at`, {}, context.accessToken).catch(() => []),
    ]);
    const states = new Map(rows<Record<string, unknown>>(statesData).map((row) => [String(row.alert_id), row]));
    const raw = rows<Record<string, unknown>>(insightsData);
    const hasMore = raw.length > PAGE_SIZE;
    const items = raw.slice(0, PAGE_SIZE).flatMap((row) => {
      const id = `orby-${String(row.id)}`;
      const state = states.get(id);
      if (state?.hidden_at) return [];
      return [{
        id,
        severity: ['critical', 'warning', 'info'].includes(String(row.severity)) ? String(row.severity) : 'info',
        title: String(row.title),
        body: String(row.body),
        generatedAt: String(row.generated_at),
        acknowledgedAt: state?.acknowledged_at ? String(state.acknowledged_at) : null,
        hiddenAt: null,
      }];
    });
    return Response.json({ items, hasMore, nextCursor: hasMore ? nextCursor(offset + PAGE_SIZE) : null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return mobileError(error); }
}
