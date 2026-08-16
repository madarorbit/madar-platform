import "server-only";

import type {
  MetricAdapterResult,
  MetricBatchResult,
  MetricDefinition,
  MetricFilter,
  MetricPeriod,
  MetricQueryRequest,
  NormalizedMetricResult,
} from "./contracts";
import {
  buildMetricCacheIdentity,
  calculateMetricComparison,
  canonicalizeMetricFilters,
  createMetricRegistry,
  evaluateMetricFreshness,
  normalizeMetricResult,
  resolveMetricUnit,
  validateMetricPeriod,
} from "./core";
import type { MetricRegistry } from "./core";

const authorizedMetricScopeBrand = Symbol("MADAR_AUTHORIZED_METRIC_SCOPE");

export type TrustedMetricWorkspaceContext = {
  /** Platform organization resolved after the existing server authorization check. */
  organizationId: string;
  /** Service workspace id; may equal organizationId for business workspaces. */
  workspaceId: string;
  /** Stable service context such as the adapter/service code. */
  service: string;
  /** Concrete workspace currency when money definitions use `currency: workspace`. */
  currency?: string | null;
  operatingMode?: string | null;
  sourceOfTruth?: string | null;
};

export type AuthorizedMetricScope = Readonly<{
  organizationId: string;
  workspaceId: string;
  service: string;
  currency: string | null;
  operatingMode: string | null;
  sourceOfTruth: string | null;
  [authorizedMetricScopeBrand]: true;
}>;

/**
 * This is not an authorization check. Call it only with identity returned by an
 * existing trusted MADAR server authorization resolver (for example the current
 * business or Retail workspace context). Raw client organization ids must never
 * be passed here as proof of access.
 */
export function metricScopeFromAuthorizedWorkspace(
  trusted: TrustedMetricWorkspaceContext,
): AuthorizedMetricScope {
  if (!trusted.organizationId || !trusted.workspaceId || !trusted.service) {
    throw new Error("METRIC_AUTHORIZED_SCOPE_REQUIRED");
  }
  return Object.freeze({
    organizationId: trusted.organizationId,
    workspaceId: trusted.workspaceId,
    service: trusted.service,
    currency: trusted.currency ?? null,
    operatingMode: trusted.operatingMode ?? null,
    sourceOfTruth: trusted.sourceOfTruth ?? null,
    [authorizedMetricScopeBrand]: true as const,
  });
}

function assertAuthorizedMetricScope(scope: AuthorizedMetricScope) {
  if (!scope || scope[authorizedMetricScopeBrand] !== true) {
    throw new Error("METRIC_UNTRUSTED_SCOPE");
  }
}

export type MetricQueryContext = Readonly<{
  scope: AuthorizedMetricScope;
  definitions: readonly MetricDefinition[];
  period: MetricPeriod;
  filters: readonly MetricFilter[];
  comparison: MetricQueryRequest["comparison"] | null;
  sourceContext: string | null;
}>;

export function createMetricQueryContext(input: {
  scope: AuthorizedMetricScope;
  request: MetricQueryRequest;
  registry: MetricRegistry;
}): MetricQueryContext {
  assertAuthorizedMetricScope(input.scope);
  if (!input.request.metricIds.length) throw new Error("METRIC_QUERY_EMPTY");
  const uniqueIds = new Set(input.request.metricIds);
  if (uniqueIds.size !== input.request.metricIds.length) throw new Error("METRIC_QUERY_DUPLICATE_ID");
  const definitions = input.request.metricIds.map((id) => input.registry.require(id));
  // Resolve units now so a missing trusted workspace currency is treated as a
  // shared request/configuration error, not as many misleading per-metric errors.
  for (const definition of definitions) resolveMetricUnit(definition, input.scope.currency);
  canonicalizeMetricFilters(input.request.filters);
  const period = validateMetricPeriod(input.request.period);
  const comparison = input.request.comparison
    ? Object.freeze({
        ...input.request.comparison,
        period: validateMetricPeriod(input.request.comparison.period),
      })
    : null;
  return Object.freeze({
    scope: input.scope,
    definitions: Object.freeze(definitions),
    period,
    filters: Object.freeze([...(input.request.filters ?? [])]),
    comparison,
    sourceContext: input.request.sourceContext?.trim() || null,
  });
}

export function metricQueryCacheKey(context: MetricQueryContext) {
  assertAuthorizedMetricScope(context.scope);
  return buildMetricCacheIdentity({
    organizationId: context.scope.organizationId,
    workspaceId: context.scope.workspaceId,
    service: context.scope.service,
    definitions: context.definitions,
    period: context.period,
    filters: context.filters,
    comparison: context.comparison,
    sourceContext: context.sourceContext ?? undefined,
  });
}

export type MetricAdapterResolveInput = Readonly<{
  definition: MetricDefinition;
  context: MetricQueryContext;
}>;

/** Future Retail/Connected/Native adapters implement this contract independently. */
export interface MetricServiceDataAdapter {
  readonly service: string;
  resolveMetric(input: MetricAdapterResolveInput): Promise<MetricAdapterResult>;
}

function errorMetricResult(input: {
  definition: MetricDefinition;
  context: MetricQueryContext;
  calculatedAt: string;
}): NormalizedMetricResult {
  const unit = resolveMetricUnit(input.definition, input.context.scope.currency);
  const comparison = input.context.comparison && input.definition.comparison === "supported"
    ? Object.freeze({
        kind: input.context.comparison.kind,
        period: input.context.comparison.period,
        ...calculateMetricComparison(null, null),
      })
    : null;
  return Object.freeze({
    metricId: input.definition.id,
    definitionVersion: input.definition.version,
    value: null,
    unit,
    period: input.context.period,
    comparison,
    dataAsOf: null,
    calculatedAt: input.calculatedAt,
    provenance: Object.freeze({ category: "unknown" as const }),
    coverage: Object.freeze({ state: "partial" as const, ratio: 0, reason: "metric_error" }),
    freshness: evaluateMetricFreshness({ dataAsOf: null, calculatedAt: input.calculatedAt }),
    // Never return raw adapter/DB exception text through a normalized UI contract.
    availability: Object.freeze({ state: "error" as const, reason: "metric_error" }),
  });
}

/**
 * Metrics fail independently by default. A service with a real shared critical
 * dependency may fail before invoking this executor; Phase 4 does not invent
 * service-specific criticality rules. Results intentionally preserve request order.
 */
export async function executeMetricBatch(input: {
  context: MetricQueryContext;
  adapter: MetricServiceDataAdapter;
  now?: Date;
}): Promise<MetricBatchResult> {
  assertAuthorizedMetricScope(input.context.scope);
  if (input.adapter.service !== input.context.scope.service) {
    throw new Error("METRIC_ADAPTER_SERVICE_MISMATCH");
  }
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("METRIC_INVALID_CALCULATION_TIME");
  const calculatedAt = now.toISOString();
  const results = await Promise.all(
    input.context.definitions.map(async (definition) => {
      try {
        const adapterResult = await input.adapter.resolveMetric({
          definition,
          context: input.context,
        });
        return normalizeMetricResult({
          definition,
          adapter: adapterResult,
          period: input.context.period,
          calculatedAt,
          workspaceCurrency: input.context.scope.currency,
          comparison: input.context.comparison,
        });
      } catch {
        return errorMetricResult({
          definition,
          context: input.context,
          calculatedAt,
        });
      }
    }),
  );
  return Object.freeze({
    calculatedAt,
    results: Object.freeze(results),
    partialFailure: results.some(
      (result) => result.availability.state !== "available" || result.coverage.state === "partial",
    ),
  });
}

export {
  createMetricRegistry,
  type MetricRegistry,
};
