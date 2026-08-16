export const METRIC_AGGREGATIONS = [
  "sum",
  "count",
  "distinct_count",
  "average",
  "ratio",
  "snapshot",
  "weighted_average",
] as const;

export type MetricAggregation = (typeof METRIC_AGGREGATIONS)[number];
export type MetricValueKind = "number" | "integer";
export type MetricComparisonCapability = "supported" | "none";
export type MetricSourceCategory =
  | "madar_native"
  | "external_connected"
  | "derived"
  | "rpc"
  | "aggregated"
  | "imported"
  | "unknown";

export type MetricUnitDefinition =
  | { kind: "number" }
  | { kind: "count" }
  | { kind: "percentage" }
  | { kind: "ratio" }
  | { kind: "duration"; unit: "milliseconds" | "seconds" | "minutes" | "hours" | "days" }
  | { kind: "money"; currency: "workspace" | { code: string } }
  | { kind: "custom"; code: string };

export type ResolvedMetricUnit =
  | { kind: "number" }
  | { kind: "count" }
  | { kind: "percentage" }
  | { kind: "ratio" }
  | { kind: "duration"; unit: "milliseconds" | "seconds" | "minutes" | "hours" | "days" }
  | { kind: "money"; currency: string }
  | { kind: "custom"; code: string };

export type MetricDefinition = {
  id: string;
  version: string;
  valueKind: MetricValueKind;
  unit: MetricUnitDefinition;
  aggregation: MetricAggregation;
  comparison: MetricComparisonCapability;
  sourceCategory?: MetricSourceCategory;
  semanticIntent?: string;
};

export type MetricPeriod = {
  /** Internal boundary: inclusive instant. */
  fromInclusive: string;
  /** Internal boundary: exclusive instant. */
  toExclusive: string;
  /** IANA timezone used to derive or interpret the boundaries. */
  timezone: string;
};

export type MetricComparisonRequest = {
  kind: "previous" | "reference" | "benchmark";
  period: MetricPeriod;
};

export type MetricFilterValue = string | number | boolean;
export type MetricFilter = {
  key: string;
  value: MetricFilterValue | readonly MetricFilterValue[];
};

/**
 * Request fields may come from presentation code. Authorization is deliberately
 * absent: organization/workspace identity is attached only by the server layer.
 */
export type MetricQueryRequest = {
  metricIds: readonly string[];
  period: MetricPeriod;
  filters?: readonly MetricFilter[];
  comparison?: MetricComparisonRequest;
  sourceContext?: string;
};

export type MetricAvailabilityState = "available" | "missing" | "unavailable" | "error";
export type MetricCoverageState = "complete" | "partial";
export type MetricFreshnessState = "fresh" | "stale" | "unknown";

export type MetricAvailability = {
  state: MetricAvailabilityState;
  reason?: string;
};

export type MetricCoverage = {
  state: MetricCoverageState;
  /** Optional observed coverage ratio, constrained to 0..1. */
  ratio?: number;
  reason?: string;
};

export type MetricFreshness = {
  state: MetricFreshnessState;
  ageSeconds?: number;
  staleAfterSeconds?: number;
  reason?: "missing_data_as_of" | "missing_policy" | "invalid_timestamp";
};

export type MetricProvenance = {
  category: MetricSourceCategory;
  /** Internal stable source key only; never credentials, URLs with secrets, or raw payloads. */
  source?: string;
  derivedFrom?: readonly string[];
};

export type MetricPercentageDeltaReason =
  | "zero_reference"
  | "missing_current"
  | "missing_reference";

export type MetricComparison = {
  referenceValue: number | null;
  absoluteDelta: number | null;
  percentageDelta: number | null;
  percentageDeltaReason: MetricPercentageDeltaReason | null;
};

export type NormalizedMetricResult = {
  metricId: string;
  definitionVersion: string;
  value: number | null;
  unit: ResolvedMetricUnit;
  period: MetricPeriod;
  comparison: MetricComparison | null;
  dataAsOf: string | null;
  calculatedAt: string;
  provenance: MetricProvenance;
  coverage: MetricCoverage;
  freshness: MetricFreshness;
  availability: MetricAvailability;
};

export type MetricAdapterReferenceValue = {
  value: number | null | undefined;
  /** Required only for money when the reference source currency could differ. */
  currency?: string;
};

/**
 * Service adapters return facts, not presentation. `value` may be explicitly
 * missing; it is never normalized to zero by the shared layer.
 */
export type MetricAdapterResult = {
  value: number | null | undefined;
  availability?: MetricAvailability;
  coverage: MetricCoverage;
  dataAsOf?: string | null;
  provenance: MetricProvenance;
  /** Optional source currency confirmation for money values. No FX is performed. */
  currency?: string;
  reference?: MetricAdapterReferenceValue;
  staleAfterSeconds?: number;
};

export type MetricBatchResult = {
  calculatedAt: string;
  results: readonly NormalizedMetricResult[];
  partialFailure: boolean;
};

export type MetricRatioResult = {
  value: number | null;
  reason: "missing_numerator" | "missing_denominator" | "zero_denominator" | null;
};

export type MetricWeightedValue = {
  value: number | null | undefined;
  weight: number | null | undefined;
};

export type MetricSnapshotPoint = {
  value: number | null | undefined;
  dataAsOf: string;
};
