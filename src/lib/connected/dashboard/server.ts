import "server-only";

import { cache } from "react";
import { supabaseFetch } from "@/src/lib/supabase/server";
import type {
  ConnectedConnection,
  ConnectedDashboardData,
  ConnectedDashboardFacts,
  ConnectedHealthFact,
  ConnectedRecordsProbe,
  ConnectedRunFact,
  ConnectedSection,
  ConnectedSourceFact,
} from "./domain";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`CONNECTED_INVALID_OBJECT:${path}`);
  return value as UnknownRecord;
}

function array(value: unknown, path: string) {
  if (!Array.isArray(value)) throw new Error(`CONNECTED_INVALID_ARRAY:${path}`);
  return value;
}

function text(value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`CONNECTED_INVALID_TEXT:${path}`);
  return value;
}

function nullableText(value: unknown, path: string) {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`CONNECTED_INVALID_TEXT:${path}`);
  return value;
}

function finiteNumber(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`CONNECTED_INVALID_NUMBER:${path}`);
  return value;
}

function integer(value: unknown, path: string) {
  const result = finiteNumber(value, path);
  if (!Number.isInteger(result)) throw new Error(`CONNECTED_INVALID_INTEGER:${path}`);
  return result;
}

function boolean(value: unknown, path: string) {
  if (typeof value !== "boolean") throw new Error(`CONNECTED_INVALID_BOOLEAN:${path}`);
  return value;
}

function normalizeConnection(input: unknown, path: string): ConnectedConnection {
  const row = record(input, path);
  return Object.freeze({
    id: text(row.id, `${path}.id`),
    name: text(row.name, `${path}.name`),
    connector_key: text(row.connector_key, `${path}.connector_key`),
    status: text(row.status, `${path}.status`),
    connection_mode: text(row.connection_mode, `${path}.connection_mode`),
    last_success_at: nullableText(row.last_success_at, `${path}.last_success_at`),
    last_error_message: nullableText(row.last_error_message, `${path}.last_error_message`),
    created_at: text(row.created_at, `${path}.created_at`),
  });
}

function normalizeHealth(input: unknown, path: string): ConnectedHealthFact | null {
  if (input === null) return null;
  const row = record(input, path);
  return Object.freeze({
    id: text(row.id, `${path}.id`),
    connection_id: text(row.connection_id, `${path}.connection_id`),
    status: text(row.status, `${path}.status`),
    freshness_seconds: row.freshness_seconds === null ? null : finiteNumber(row.freshness_seconds, `${path}.freshness_seconds`),
    success_rate: finiteNumber(row.success_rate, `${path}.success_rate`),
    quality_score: finiteNumber(row.quality_score, `${path}.quality_score`),
    queue_depth: integer(row.queue_depth, `${path}.queue_depth`),
    open_issues: integer(row.open_issues, `${path}.open_issues`),
    captured_at: text(row.captured_at, `${path}.captured_at`),
  });
}

function normalizeRun(input: unknown, path: string): ConnectedRunFact | null {
  if (input === null) return null;
  const row = record(input, path);
  return Object.freeze({
    id: text(row.id, `${path}.id`),
    connection_id: text(row.connection_id, `${path}.connection_id`),
    sync_mode: text(row.sync_mode, `${path}.sync_mode`),
    status: text(row.status, `${path}.status`),
    records_received: finiteNumber(row.records_received, `${path}.records_received`),
    error_message: nullableText(row.error_message, `${path}.error_message`),
    started_at: text(row.started_at, `${path}.started_at`),
    finished_at: nullableText(row.finished_at, `${path}.finished_at`),
  });
}

function normalizeSourceFact(input: unknown, index: number): ConnectedSourceFact {
  const path = `sources.${index}`;
  const row = record(input, path);
  return Object.freeze({
    connection_id: text(row.connection_id, `${path}.connection_id`),
    name: text(row.name, `${path}.name`),
    connector_key: text(row.connector_key, `${path}.connector_key`),
    connection_status: text(row.connection_status, `${path}.connection_status`),
    connection_mode: text(row.connection_mode, `${path}.connection_mode`),
    last_success_at: nullableText(row.last_success_at, `${path}.last_success_at`),
    last_error_message: nullableText(row.last_error_message, `${path}.last_error_message`),
    created_at: text(row.created_at, `${path}.created_at`),
    latest_health: normalizeHealth(row.latest_health, `${path}.latest_health`),
    latest_run: normalizeRun(row.latest_run, `${path}.latest_run`),
    open_incident_count: integer(row.open_incident_count, `${path}.open_incident_count`),
    has_critical_incident: boolean(row.has_critical_incident, `${path}.has_critical_incident`),
    has_error_incident: boolean(row.has_error_incident, `${path}.has_error_incident`),
    has_warning_incident: boolean(row.has_warning_incident, `${path}.has_warning_incident`),
  });
}

export function normalizeConnectedDashboardFacts(input: unknown): ConnectedDashboardFacts {
  const source = record(input, "facts");
  const summary = record(source.summary, "facts.summary");
  return Object.freeze({
    sources: Object.freeze(array(source.sources, "facts.sources").map(normalizeSourceFact)),
    summary: Object.freeze({
      connection_count: integer(summary.connection_count, "facts.summary.connection_count"),
      open_incident_count: integer(summary.open_incident_count, "facts.summary.open_incident_count"),
      sources_with_critical_incident: integer(summary.sources_with_critical_incident, "facts.summary.sources_with_critical_incident"),
      sources_with_error_incident: integer(summary.sources_with_error_incident, "facts.summary.sources_with_error_incident"),
      sources_with_warning_incident: integer(summary.sources_with_warning_incident, "facts.summary.sources_with_warning_incident"),
      latest_success_at: nullableText(summary.latest_success_at, "facts.summary.latest_success_at"),
    }),
  });
}

async function section<T>(operation: Promise<T>, fallback: T): Promise<ConnectedSection<T>> {
  try {
    return Object.freeze({ data: await operation, failed: false });
  } catch {
    return Object.freeze({ data: fallback, failed: true });
  }
}

async function loadConnections(organizationId: string) {
  const id = encodeURIComponent(organizationId);
  const raw = await supabaseFetch(`/rest/v1/integration_connections?organization_id=eq.${id}&deleted_at=is.null&select=id,name,connector_key,status,connection_mode,last_success_at,last_error_message,created_at&order=created_at.desc`);
  return Object.freeze(array(raw, "connections").map((item, index) => normalizeConnection(item, `connections.${index}`)));
}

async function loadFacts(organizationId: string) {
  const raw = await supabaseFetch("/rest/v1/rpc/connected_dashboard_facts", {
    method: "POST",
    body: JSON.stringify({ target_organization: organizationId }),
  });
  return normalizeConnectedDashboardFacts(raw);
}

async function loadRecordsProbe(organizationId: string): Promise<ConnectedRecordsProbe> {
  const id = encodeURIComponent(organizationId);
  // This is deliberately an existence/latest probe, never a total. LIMIT 1 cannot
  // be misread as global record volume and keeps the Overview out of analytics scope.
  const raw = await supabaseFetch(`/rest/v1/integration_udm_records?organization_id=eq.${id}&duplicate_of=is.null&select=id,source_updated_at,updated_at&order=updated_at.desc&limit=1`);
  const rows = array(raw, "records_probe");
  if (!rows.length) return Object.freeze({ hasRecords: false, latestRecordUpdatedAt: null, latestSourceUpdatedAt: null });
  const row = record(rows[0], "records_probe.0");
  return Object.freeze({
    hasRecords: true,
    latestRecordUpdatedAt: text(row.updated_at, "records_probe.0.updated_at"),
    latestSourceUpdatedAt: nullableText(row.source_updated_at, "records_probe.0.source_updated_at"),
  });
}

const emptyFacts: ConnectedDashboardFacts = Object.freeze({
  sources: Object.freeze([]),
  summary: Object.freeze({
    connection_count: 0,
    open_incident_count: 0,
    sources_with_critical_incident: 0,
    sources_with_error_incident: 0,
    sources_with_warning_incident: 0,
    latest_success_at: null,
  }),
});

const emptyRecords: ConnectedRecordsProbe = Object.freeze({
  hasRecords: false,
  latestRecordUpdatedAt: null,
  latestSourceUpdatedAt: null,
});

export const getConnectedDashboardData = cache(async (organizationId: string): Promise<ConnectedDashboardData> => {
  const [connections, facts, records] = await Promise.all([
    section(loadConnections(organizationId), Object.freeze([]) as readonly ConnectedConnection[]),
    section(loadFacts(organizationId), emptyFacts),
    section(loadRecordsProbe(organizationId), emptyRecords),
  ]);
  return Object.freeze({ connections, facts, records });
});
