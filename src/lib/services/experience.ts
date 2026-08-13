import "server-only";

import { cache } from "react";
import { supabaseFetch } from "@/src/lib/supabase/server";

export type ServiceSection<T> = { data: T; failed: boolean };

async function section<T>(operation: Promise<T>, fallback: T): Promise<ServiceSection<T>> {
  try {
    return { data: await operation, failed: false };
  } catch {
    return { data: fallback, failed: true };
  }
}

export type ConnectedConnection = {
  id: string;
  name: string;
  connector_key: string;
  status: string;
  connection_mode: string;
  last_tested_at: string | null;
  last_success_at: string | null;
  last_error_message: string | null;
  created_at: string;
};

export type ConnectedHealth = {
  id: string;
  connection_id: string | null;
  status: string;
  freshness_seconds: number | null;
  success_rate: number;
  quality_score: number;
  queue_depth: number;
  open_issues: number;
  captured_at: string;
};

export type ConnectedSyncRun = {
  id: string;
  connection_id: string;
  sync_mode: string;
  status: string;
  records_received: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

export type ConnectedIncident = {
  id: string;
  connection_id: string;
  severity: string;
  title: string;
  status: string;
  opened_at: string;
};

export type ConnectedRecord = {
  id: string;
  entity_type: string;
  quality_score: number;
  source_updated_at: string | null;
  updated_at: string;
};

export type ConnectedOverview = {
  connections: ServiceSection<ConnectedConnection[]>;
  health: ServiceSection<ConnectedHealth[]>;
  runs: ServiceSection<ConnectedSyncRun[]>;
  incidents: ServiceSection<ConnectedIncident[]>;
  records: ServiceSection<ConnectedRecord[]>;
};

export const getConnectedOverview = cache(async (organizationId: string): Promise<ConnectedOverview> => {
  const id = encodeURIComponent(organizationId);
  const [connections, health, runs, incidents, records] = await Promise.all([
    section(supabaseFetch(`/rest/v1/integration_connections?organization_id=eq.${id}&deleted_at=is.null&select=id,name,connector_key,status,connection_mode,last_tested_at,last_success_at,last_error_message,created_at&order=created_at.desc`) as Promise<ConnectedConnection[]>, []),
    section(supabaseFetch(`/rest/v1/integration_health_snapshots?organization_id=eq.${id}&select=id,connection_id,status,freshness_seconds,success_rate,quality_score,queue_depth,open_issues,captured_at&order=captured_at.desc&limit=50`) as Promise<ConnectedHealth[]>, []),
    section(supabaseFetch(`/rest/v1/integration_sync_runs?organization_id=eq.${id}&select=id,connection_id,sync_mode,status,records_received,error_message,started_at,finished_at&order=started_at.desc&limit=8`) as Promise<ConnectedSyncRun[]>, []),
    section(supabaseFetch(`/rest/v1/integration_health_incidents?organization_id=eq.${id}&status=neq.resolved&select=id,connection_id,severity,title,status,opened_at&order=opened_at.desc&limit=8`) as Promise<ConnectedIncident[]>, []),
    section(supabaseFetch(`/rest/v1/integration_udm_records?organization_id=eq.${id}&duplicate_of=is.null&select=id,entity_type,quality_score,source_updated_at,updated_at&order=updated_at.desc&limit=1000`) as Promise<ConnectedRecord[]>, []),
  ]);
  return { connections, health, runs, incidents, records };
});

export function latestHealthByConnection(health: ConnectedHealth[]) {
  const latest = new Map<string, ConnectedHealth>();
  for (const item of health) {
    if (item.connection_id && !latest.has(item.connection_id)) latest.set(item.connection_id, item);
  }
  return latest;
}

export function connectionStatusLabel(status: string) {
  return ({
    draft: "غير مكتمل",
    verifying: "جارٍ الاختبار",
    active: "متصل",
    paused: "متوقف مؤقتًا",
    error: "خطأ في الاتصال",
    disconnected: "غير متصل",
    archived: "مؤرشف",
    healthy: "سليم",
    degraded: "يحتاج متابعة",
    unhealthy: "غير سليم",
    unknown: "غير محدد",
    running: "جارٍ المزامنة",
    succeeded: "اكتملت",
    failed: "فشلت",
    cancelled: "أُلغيت",
  } as Record<string, string>)[status] || status;
}

export function connectionStatusTone(status: string): "active" | "pending" | "error" | "suspended" | "draft" {
  if (["active", "healthy", "succeeded"].includes(status)) return "active";
  if (["verifying", "running", "degraded"].includes(status)) return "pending";
  if (["error", "unhealthy", "failed", "disconnected"].includes(status)) return "error";
  if (["paused", "cancelled"].includes(status)) return "suspended";
  return "draft";
}
