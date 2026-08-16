import type { MetricDefinition, NormalizedMetricResult } from "../../dashboard/metrics/contracts.ts";
import { createMetricRegistry, metricPeriodFromDateSelection, normalizeMetricResult } from "../../dashboard/metrics/core.ts";

export type ConnectedSection<T> = Readonly<{ data: T; failed: boolean }>;

export type ConnectedConnection = Readonly<{
  id: string;
  name: string;
  connector_key: string;
  status: string;
  connection_mode: string;
  last_success_at: string | null;
  last_error_message: string | null;
  created_at: string;
}>;

export type ConnectedHealthFact = Readonly<{
  id: string;
  connection_id: string;
  status: string;
  freshness_seconds: number | null;
  success_rate: number;
  quality_score: number;
  queue_depth: number;
  open_issues: number;
  captured_at: string;
}>;

export type ConnectedRunFact = Readonly<{
  id: string;
  connection_id: string;
  sync_mode: string;
  status: string;
  records_received: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}>;

export type ConnectedSourceFact = Readonly<{
  connection_id: string;
  name: string;
  connector_key: string;
  connection_status: string;
  connection_mode: string;
  last_success_at: string | null;
  last_error_message: string | null;
  created_at: string;
  latest_health: ConnectedHealthFact | null;
  latest_run: ConnectedRunFact | null;
  open_incident_count: number;
  has_critical_incident: boolean;
  has_error_incident: boolean;
  has_warning_incident: boolean;
}>;

export type ConnectedFactsSummary = Readonly<{
  connection_count: number;
  open_incident_count: number;
  sources_with_critical_incident: number;
  sources_with_error_incident: number;
  sources_with_warning_incident: number;
  latest_success_at: string | null;
}>;

export type ConnectedDashboardFacts = Readonly<{
  sources: readonly ConnectedSourceFact[];
  summary: ConnectedFactsSummary;
}>;

export type ConnectedRecordsProbe = Readonly<{
  hasRecords: boolean;
  latestRecordUpdatedAt: string | null;
  latestSourceUpdatedAt: string | null;
}>;

export type ConnectedDashboardData = Readonly<{
  connections: ConnectedSection<readonly ConnectedConnection[]>;
  facts: ConnectedSection<ConnectedDashboardFacts | null>;
  records: ConnectedSection<ConnectedRecordsProbe>;
}>;

export type ConnectedReadiness = "ready" | "attention" | "repair" | "incomplete" | "unknown" | "setup";
export type ConnectedSourceState = ConnectedReadiness | "paused";

type ConnectedMetricId =
  | "connected.ready_sources"
  | "connected.total_sources"
  | "connected.open_issues"
  | "connected.sources_needing_action"
  | "connected.seconds_since_last_success"
  | "connected.source_freshness_seconds"
  | "connected.source_open_issues";

const definitions = [
  { id: "connected.ready_sources", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "external_connected", semanticIntent: "عدد المصادر الجاهزة وفق حالة الاتصال وآخر Health موثوقة" },
  { id: "connected.total_sources", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "external_connected", semanticIntent: "إجمالي الاتصالات الحالية غير المحذوفة" },
  { id: "connected.open_issues", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "rpc", semanticIntent: "العدد الدقيق للمشكلات المفتوحة عبر مصادر Connected" },
  { id: "connected.sources_needing_action", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "derived", semanticIntent: "عدد المصادر المصنفة يحتاج إصلاحًا أو متابعة وفق حقائق domain موثوقة" },
  { id: "connected.seconds_since_last_success", version: "1", valueKind: "number", unit: { kind: "duration", unit: "seconds" }, aggregation: "snapshot", comparison: "none", sourceCategory: "derived", semanticIntent: "المدة منذ أحدث مزامنة ناجحة موثقة" },
  { id: "connected.source_freshness_seconds", version: "1", valueKind: "number", unit: { kind: "duration", unit: "seconds" }, aggregation: "snapshot", comparison: "none", sourceCategory: "external_connected", semanticIntent: "freshness_seconds كما تبلغها أحدث Health دون تصنيف جيد أو سيئ بلا policy" },
  { id: "connected.source_open_issues", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "rpc", semanticIntent: "المشكلات المفتوحة الدقيقة للمصدر المتصل" },
] as const satisfies readonly MetricDefinition[];

export const connectedOverviewMetricRegistry = createMetricRegistry(definitions);

function utcSnapshotPeriod(calculatedAt: string) {
  const parsed = new Date(calculatedAt);
  if (!Number.isFinite(parsed.getTime())) throw new Error("CONNECTED_INVALID_CALCULATED_AT");
  const date = parsed.toISOString().slice(0, 10);
  return metricPeriodFromDateSelection({ fromDate: date, toDateInclusive: date, timezone: "UTC" });
}

function safeRatio(observed: number, total: number) {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, observed / total));
}

function normalizedMetric(input: {
  id: ConnectedMetricId;
  value: number | null | undefined;
  calculatedAt: string;
  dataAsOf?: string | null;
  availability?: { state: "available" | "missing" | "unavailable" | "error"; reason?: string };
  coverage?: { state: "complete" | "partial"; ratio?: number; reason?: string };
  source?: string;
  derivedFrom?: readonly string[];
}) {
  const definition = connectedOverviewMetricRegistry.require(input.id);
  return normalizeMetricResult({
    definition,
    adapter: {
      value: input.value,
      availability: input.availability,
      coverage: input.coverage ?? { state: "complete" },
      dataAsOf: input.dataAsOf ?? null,
      provenance: {
        category: definition.sourceCategory ?? "unknown",
        source: input.source,
        derivedFrom: input.derivedFrom,
      },
    },
    period: utcSnapshotPeriod(input.calculatedAt),
    calculatedAt: input.calculatedAt,
  });
}

function sourceState(source: ConnectedSourceFact): ConnectedSourceState {
  const health = source.latest_health;
  if (["error", "disconnected"].includes(source.connection_status)) return "repair";
  if (health?.status === "unhealthy") return "repair";
  if (source.has_critical_incident || source.has_error_incident) return "repair";
  if (["draft", "verifying"].includes(source.connection_status)) return "setup";
  if (health?.status === "degraded" || source.has_warning_incident || source.latest_run?.status === "failed") return "attention";
  if (source.connection_status === "paused") return "paused";
  if (!health) return "incomplete";
  if (health.status === "unknown") return "unknown";
  if (source.connection_status === "active" && health.status === "healthy") return "ready";
  return "incomplete";
}

function sourceReason(source: ConnectedSourceFact, state: ConnectedSourceState) {
  if (["error", "disconnected"].includes(source.connection_status)) return "حالة الاتصال تمنع الاعتماد على تدفق البيانات.";
  if (source.latest_health?.status === "unhealthy") return "أحدث Health موثقة تصنف الاتصال غير سليم.";
  if (source.has_critical_incident || source.has_error_incident) return "هناك incident حرج أو خطأ مفتوح يحتاج إصلاحًا.";
  if (source.latest_health?.status === "degraded") return "أحدث Health موثقة تشير إلى تدهور يحتاج متابعة.";
  if (source.has_warning_incident) return "هناك warning مفتوح يحتاج متابعة.";
  if (source.latest_run?.status === "failed") return "آخر مزامنة مسجلة فشلت وتحتاج فحصًا.";
  if (["draft", "verifying"].includes(source.connection_status)) return "إعداد الاتصال لم يكتمل بعد.";
  if (source.connection_status === "paused") return "الاتصال موقوف مؤقتًا؛ الإيقاف بحد ذاته لا يُعامل كعطل.";
  if (!source.latest_health) return "لا توجد Health موثقة لهذا الاتصال حتى الآن.";
  if (source.latest_health.status === "unknown") return "أحدث Health لا تعطي حكمًا موثوقًا على الحالة.";
  if (state === "ready") return "الاتصال نشط وأحدث Health موثقة سليمة.";
  return "لا تتوفر حقائق كافية لتأكيد الجاهزية.";
}

function oldestHealthCapture(sources: readonly ConnectedSourceFact[]) {
  const values = sources
    .map((source) => source.latest_health?.captured_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return values.length ? new Date(Math.min(...values)).toISOString() : null;
}

function durationSince(calculatedAt: string, sourceAt: string | null) {
  if (!sourceAt) return null;
  const now = Date.parse(calculatedAt);
  const source = Date.parse(sourceAt);
  if (!Number.isFinite(now) || !Number.isFinite(source) || source > now) return null;
  return (now - source) / 1000;
}

export type ConnectedSourceOverview = Readonly<{
  id: string;
  name: string;
  connectorKey: string;
  connectionStatus: string;
  state: ConnectedSourceState;
  reason: string;
  latestHealthStatus: string | null;
  healthCapturedAt: string | null;
  latestRunStatus: string | null;
  lastSuccessAt: string | null;
  freshness: NormalizedMetricResult;
  openIssues: NormalizedMetricResult;
}>;

export type ConnectedOverviewModel = Readonly<{
  readiness: ConnectedReadiness;
  readinessLabel: string;
  readinessDescription: string;
  isFirstUse: boolean;
  isPartial: boolean;
  failedSources: readonly string[];
  primary: Readonly<{
    readySources: NormalizedMetricResult;
    totalSources: NormalizedMetricResult;
    openIssues: NormalizedMetricResult;
    sourcesNeedingAction: NormalizedMetricResult;
    secondsSinceLastSuccess: NormalizedMetricResult;
  }>;
  latestSuccessAt: string | null;
  sources: readonly ConnectedSourceOverview[];
  criticalSources: readonly ConnectedSourceOverview[];
  attentionSources: readonly ConnectedSourceOverview[];
  incompleteSources: readonly ConnectedSourceOverview[];
  pausedSources: readonly ConnectedSourceOverview[];
  hasRecords: boolean | null;
}>;

const readinessLabels: Record<ConnectedReadiness, string> = {
  ready: "جاهز",
  attention: "يحتاج متابعة",
  repair: "يحتاج إصلاحًا",
  incomplete: "غير مكتمل",
  unknown: "غير معروف",
  setup: "إعداد أولي",
};

function readinessDescription(state: ConnectedReadiness, sourceCount: number, hasRecords: boolean | null) {
  if (state === "repair") return "هناك مصدر واحد على الأقل تمنع حالته أو Health أو incident موثقة الاعتماد عليه قبل الإصلاح.";
  if (state === "attention") return "الاتصالات تعمل، لكن توجد حقائق موثقة تستحق المتابعة قبل اعتبار الصورة مستقرة بالكامل.";
  if (state === "incomplete") return "بعض بيانات الصحة أو المصدر غير مكتملة؛ لا تفترض مَدار أن الغياب يعني سلامة.";
  if (state === "unknown") return "تعذر جمع حقائق كافية لإصدار حكم موثوق على Connected الآن.";
  if (state === "setup") return sourceCount === 0
    ? "لم يتم إعداد أي مصدر متصل بعد."
    : hasRecords === false
      ? "تم إعداد الاتصال، لكن لم تصل بيانات UDM بعد؛ ما زالت الخدمة في مرحلة الإعداد الأولي."
      : "هناك اتصالات ما زالت في مرحلة الإعداد أو التحقق.";
  return "المصادر النشطة التي يمكن تقييمها سليمة، ولا توجد حقائق حالية تفرض إصلاحًا أو متابعة.";
}

export function buildConnectedOverviewModel(data: ConnectedDashboardData, calculatedAt: string): ConnectedOverviewModel {
  const failedSources = [
    data.connections.failed ? "connections" : null,
    data.facts.failed ? "health/incidents/runs" : null,
    data.records.failed ? "records" : null,
  ].filter((value): value is string => Boolean(value));

  const facts = data.facts.data;
  const fallbackCount = data.connections.failed ? 0 : data.connections.data.length;
  const exactCount = facts?.summary.connection_count ?? fallbackCount;
  const isFirstUse = !data.connections.failed && !data.facts.failed && exactCount === 0;
  const sourceRows = facts?.sources ?? [];
  const healthObserved = sourceRows.filter((source) => source.latest_health).length;
  const healthCoverage = safeRatio(healthObserved, exactCount);
  const metricCoverage = data.facts.failed
    ? { state: "partial" as const, ratio: 0, reason: "connected_facts_unavailable" }
    : healthObserved === exactCount
      ? { state: "complete" as const }
      : { state: "partial" as const, ratio: healthCoverage, reason: "missing_health_for_some_sources" };

  const sources: ConnectedSourceOverview[] = sourceRows.map((source) => {
    const state = sourceState(source);
    const health = source.latest_health;
    return Object.freeze({
      id: source.connection_id,
      name: source.name,
      connectorKey: source.connector_key,
      connectionStatus: source.connection_status,
      state,
      reason: sourceReason(source, state),
      latestHealthStatus: health?.status ?? null,
      healthCapturedAt: health?.captured_at ?? null,
      latestRunStatus: source.latest_run?.status ?? null,
      lastSuccessAt: source.last_success_at,
      freshness: normalizedMetric({
        id: "connected.source_freshness_seconds",
        value: health?.freshness_seconds,
        calculatedAt,
        dataAsOf: health?.captured_at ?? null,
        availability: health
          ? health.freshness_seconds === null
            ? { state: "missing", reason: "source_freshness_not_reported" }
            : { state: "available" }
          : { state: "unavailable", reason: "health_snapshot_missing" },
        coverage: health ? { state: "complete" } : { state: "partial", ratio: 0, reason: "health_snapshot_missing" },
        source: `integration_health_snapshots:${source.connection_id}`,
      }),
      openIssues: normalizedMetric({
        id: "connected.source_open_issues",
        value: source.open_incident_count,
        calculatedAt,
        availability: data.facts.failed ? { state: "error", reason: "connected_facts_unavailable" } : { state: "available" },
        coverage: data.facts.failed ? { state: "partial", ratio: 0 } : { state: "complete" },
        source: "connected_dashboard_facts",
      }),
    });
  });

  const rank: Record<ConnectedSourceState, number> = {
    repair: 0,
    attention: 1,
    incomplete: 2,
    unknown: 3,
    setup: 4,
    paused: 5,
    ready: 6,
  };
  sources.sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name, "ar"));

  const criticalSources = sources.filter((source) => source.state === "repair");
  const attentionSources = sources.filter((source) => source.state === "attention");
  const incompleteSources = sources.filter((source) => ["incomplete", "unknown", "setup"].includes(source.state));
  const pausedSources = sources.filter((source) => source.state === "paused");
  const readyCount = sources.filter((source) => source.state === "ready").length;
  const needsActionCount = criticalSources.length + attentionSources.length;
  const recordsValue = data.records.failed ? null : data.records.data.hasRecords;

  let readiness: ConnectedReadiness;
  if (isFirstUse) readiness = "setup";
  else if (data.facts.failed) {
    const hardConnectionFailure = data.connections.data.some((connection) => ["error", "disconnected"].includes(connection.status));
    readiness = hardConnectionFailure ? "repair" : data.connections.failed ? "unknown" : "incomplete";
  } else if (criticalSources.length) readiness = "repair";
  else if (attentionSources.length) readiness = "attention";
  else if (incompleteSources.length) readiness = incompleteSources.every((source) => source.state === "unknown") ? "unknown" : "incomplete";
  else if (data.records.failed) readiness = "incomplete";
  else if (recordsValue === false) readiness = "setup";
  else if (readyCount > 0) readiness = "ready";
  else readiness = pausedSources.length === exactCount && exactCount > 0 ? "incomplete" : "unknown";

  const factsAvailability = data.facts.failed
    ? { state: "error" as const, reason: "connected_facts_unavailable" }
    : { state: "available" as const };
  const healthDataAsOf = oldestHealthCapture(sourceRows);
  const latestSuccessAt = facts?.summary.latest_success_at ?? null;
  const lastSuccessSeconds = durationSince(calculatedAt, latestSuccessAt);

  const primary = Object.freeze({
    readySources: normalizedMetric({
      id: "connected.ready_sources",
      value: data.facts.failed ? null : readyCount,
      calculatedAt,
      dataAsOf: healthDataAsOf,
      availability: data.facts.failed ? factsAvailability : { state: "available" },
      coverage: metricCoverage,
      source: "connected_dashboard_facts",
      derivedFrom: ["integration_connections.status", "integration_health_snapshots.status"],
    }),
    totalSources: normalizedMetric({
      id: "connected.total_sources",
      value: data.facts.failed ? (data.connections.failed ? null : fallbackCount) : exactCount,
      calculatedAt,
      availability: data.facts.failed && data.connections.failed ? { state: "error", reason: "connections_unavailable" } : { state: "available" },
      coverage: data.facts.failed ? { state: "partial", ratio: data.connections.failed ? 0 : 1, reason: "exact_rpc_count_unavailable" } : { state: "complete" },
      source: data.facts.failed ? "integration_connections" : "connected_dashboard_facts",
    }),
    openIssues: normalizedMetric({
      id: "connected.open_issues",
      value: data.facts.failed ? null : facts?.summary.open_incident_count,
      calculatedAt,
      availability: factsAvailability,
      coverage: data.facts.failed ? { state: "partial", ratio: 0 } : { state: "complete" },
      source: "connected_dashboard_facts",
    }),
    sourcesNeedingAction: normalizedMetric({
      id: "connected.sources_needing_action",
      value: data.facts.failed ? null : needsActionCount,
      calculatedAt,
      dataAsOf: healthDataAsOf,
      availability: factsAvailability,
      coverage: metricCoverage,
      source: "connected_dashboard_facts",
      derivedFrom: ["integration_connections.status", "integration_health_snapshots.status", "integration_health_incidents.severity", "integration_sync_runs.status"],
    }),
    secondsSinceLastSuccess: normalizedMetric({
      id: "connected.seconds_since_last_success",
      value: data.facts.failed ? null : lastSuccessSeconds,
      calculatedAt,
      dataAsOf: latestSuccessAt,
      availability: data.facts.failed
        ? factsAvailability
        : latestSuccessAt && lastSuccessSeconds !== null
          ? { state: "available" }
          : { state: "missing", reason: "no_successful_sync_yet" },
      coverage: data.facts.failed ? { state: "partial", ratio: 0 } : { state: "complete" },
      source: "integration_connections.last_success_at",
    }),
  });

  return Object.freeze({
    readiness,
    readinessLabel: readinessLabels[readiness],
    readinessDescription: readinessDescription(readiness, exactCount, recordsValue),
    isFirstUse,
    isPartial: failedSources.length > 0 || metricCoverage.state === "partial",
    failedSources: Object.freeze(failedSources),
    primary,
    latestSuccessAt,
    sources: Object.freeze(sources),
    criticalSources: Object.freeze(criticalSources),
    attentionSources: Object.freeze(attentionSources),
    incompleteSources: Object.freeze(incompleteSources),
    pausedSources: Object.freeze(pausedSources),
    hasRecords: recordsValue,
  });
}
