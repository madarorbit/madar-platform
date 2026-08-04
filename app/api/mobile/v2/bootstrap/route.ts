import { GET as legacyDashboard } from '@/app/api/mobile/v1/dashboard/route';
import { mobileContext, mobileError, scalar } from '@/src/lib/mobile/v2';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await mobileContext(request);
    const legacy = await legacyDashboard(request);
    if (!legacy.ok) return legacy;
    const payload = await legacy.json() as Record<string, any>;
    const [settingsData, connectionsData, runsData] = await Promise.all([
      supabaseFetch('/rest/v1/mobile_v2_settings?id=eq.1&select=external_writes_enabled,stale_after_seconds,max_attachment_bytes', {}, context.accessToken).catch(() => []),
      supabaseFetch(`/rest/v1/integration_connections?organization_id=eq.${encodeURIComponent(context.workspaceId)}&deleted_at=is.null&select=id,status,connection_mode,last_success_at,last_error_code&order=last_success_at.desc.nullslast&limit=1`, {}, context.accessToken).catch(() => []),
      supabaseFetch(`/rest/v1/integration_sync_runs?organization_id=eq.${encodeURIComponent(context.workspaceId)}&select=status,finished_at,started_at,error_code&order=started_at.desc&limit=1`, {}, context.accessToken).catch(() => []),
    ]);
    const settings = scalar<{ external_writes_enabled?: boolean; stale_after_seconds?: number; max_attachment_bytes?: number }>(settingsData) || {};
    const connection = scalar<{ status: string; connection_mode: string; last_success_at: string | null; last_error_code: string | null }>(connectionsData);
    const run = scalar<{ status: string; finished_at: string | null; started_at: string; error_code: string | null }>(runsData);
    const operatingMode = payload.workspace?.operatingMode || 'MADAR_NATIVE';
    const staleAfterSeconds = Number(settings.stale_after_seconds || 300);
    const lastSyncedAt = operatingMode === 'MADAR_NATIVE'
      ? payload.fetchedAt
      : connection?.last_success_at || run?.finished_at || run?.started_at || payload.fetchedAt;
    const ageSeconds = Math.max(0, (Date.now() - Date.parse(lastSyncedAt)) / 1000);
    const connectorState = operatingMode === 'MADAR_NATIVE'
      ? 'not_required'
      : connection?.status === 'active' && !connection.last_error_code
        ? 'connected'
        : connection?.status === 'error' || connection?.last_error_code
          ? 'degraded'
          : connection
            ? 'disconnected'
            : 'unknown';
    const isStale = operatingMode === 'CONNECTED_EXTERNAL' && (ageSeconds > staleAfterSeconds || connectorState !== 'connected');
    return Response.json({
      ...payload,
      contractVersion: '2.0',
      sync: { state: isStale ? 'delayed' : 'live', lastSyncedAt, connectorState, isStale, staleAfterSeconds },
      capabilities: {
        canWriteInternal: true,
        canWriteExternal: Boolean(settings.external_writes_enabled && connection?.status === 'active' && connection.connection_mode === 'WRITE_LIMITED'),
        canUseOrby: true,
        canUploadAttachments: true,
        canUsePush: true,
      },
      limits: { maxAttachmentBytes: Number(settings.max_attachment_bytes || 5242880) },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return mobileError(error); }
}
