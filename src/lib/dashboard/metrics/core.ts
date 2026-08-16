import type {
  MetricAdapterResult,
  MetricComparison,
  MetricCoverage,
  MetricDefinition,
  MetricFilter,
  MetricPeriod,
  MetricRatioResult,
  MetricSnapshotPoint,
  MetricWeightedValue,
  NormalizedMetricResult,
  ResolvedMetricUnit,
} from "./contracts";

const METRIC_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const FILTER_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeCurrencyCode(currency: string) {
  const normalized = currency.trim().toUpperCase();
  if (!ISO_CURRENCY_PATTERN.test(normalized)) throw new Error("METRIC_INVALID_CURRENCY");
  return normalized;
}

export function validateMetricDefinition(definition: MetricDefinition): MetricDefinition {
  if (!METRIC_ID_PATTERN.test(definition.id)) throw new Error(`METRIC_INVALID_ID:${definition.id}`);
  if (!definition.version.trim()) throw new Error(`METRIC_INVALID_VERSION:${definition.id}`);
  if (definition.semanticIntent !== undefined && !definition.semanticIntent.trim()) {
    throw new Error(`METRIC_INVALID_INTENT:${definition.id}`);
  }
  if (definition.unit.kind === "money" && definition.unit.currency !== "workspace") {
    normalizeCurrencyCode(definition.unit.currency.code);
  }
  if (definition.unit.kind === "custom" && !definition.unit.code.trim()) {
    throw new Error(`METRIC_INVALID_CUSTOM_UNIT:${definition.id}`);
  }
  return Object.freeze({ ...definition });
}

export type MetricRegistry = ReturnType<typeof createMetricRegistry>;

export function createMetricRegistry(definitions: readonly MetricDefinition[]) {
  const byId = new Map<string, MetricDefinition>();
  for (const input of definitions) {
    const definition = validateMetricDefinition(input);
    if (byId.has(definition.id)) throw new Error(`METRIC_DUPLICATE_ID:${definition.id}`);
    byId.set(definition.id, definition);
  }
  const list = Object.freeze([...byId.values()]);
  return Object.freeze({
    get(id: string) {
      return byId.get(id) ?? null;
    },
    require(id: string) {
      const definition = byId.get(id);
      if (!definition) throw new Error(`METRIC_NOT_REGISTERED:${id}`);
      return definition;
    },
    has(id: string) {
      return byId.has(id);
    },
    list() {
      return list;
    },
  });
}

export function validateTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error(`METRIC_INVALID_TIMEZONE:${timezone}`);
  }
  return timezone;
}

function parseDateOnly(value: string) {
  if (!DATE_PATTERN.test(value)) throw new Error(`METRIC_INVALID_DATE:${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) throw new Error(`METRIC_INVALID_DATE:${value}`);
  return { year, month, day };
}

export function shiftMetricDate(value: string, days: number) {
  const { year, month, day } = parseDateOnly(value);
  if (!Number.isInteger(days)) throw new Error("METRIC_INVALID_DATE_SHIFT");
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function zonedParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA-u-hc-h23", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

/** Converts a local calendar midnight to its real UTC instant without using server locale. */
export function localDateBoundaryToUtc(value: string, timezone: string) {
  validateTimeZone(timezone);
  const target = parseDateOnly(value);
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day);
  let guess = targetAsUtc;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const local = zonedParts(new Date(guess), timezone);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const delta = targetAsUtc - localAsUtc;
    if (delta === 0) break;
    guess += delta;
  }
  const resolved = zonedParts(new Date(guess), timezone);
  if (
    resolved.year !== target.year ||
    resolved.month !== target.month ||
    resolved.day !== target.day ||
    resolved.hour !== 0 ||
    resolved.minute !== 0 ||
    resolved.second !== 0
  ) {
    throw new Error(`METRIC_UNRESOLVABLE_LOCAL_BOUNDARY:${value}:${timezone}`);
  }
  return new Date(guess).toISOString();
}

/** User-facing inclusive dates become internal [from inclusive, to exclusive) instants. */
export function metricPeriodFromDateSelection(input: {
  fromDate: string;
  toDateInclusive: string;
  timezone: string;
}): MetricPeriod {
  const from = parseDateOnly(input.fromDate);
  const to = parseDateOnly(input.toDateInclusive);
  const fromEpoch = Date.UTC(from.year, from.month - 1, from.day);
  const toEpoch = Date.UTC(to.year, to.month - 1, to.day);
  if (toEpoch < fromEpoch) throw new Error("METRIC_INVALID_PERIOD_ORDER");
  return Object.freeze({
    fromInclusive: localDateBoundaryToUtc(input.fromDate, input.timezone),
    toExclusive: localDateBoundaryToUtc(shiftMetricDate(input.toDateInclusive, 1), input.timezone),
    timezone: validateTimeZone(input.timezone),
  });
}

export function validateMetricPeriod(period: MetricPeriod): MetricPeriod {
  validateTimeZone(period.timezone);
  const from = Date.parse(period.fromInclusive);
  const to = Date.parse(period.toExclusive);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error("METRIC_INVALID_PERIOD");
  return Object.freeze({
    fromInclusive: new Date(from).toISOString(),
    toExclusive: new Date(to).toISOString(),
    timezone: period.timezone,
  });
}

export function calculateMetricComparison(
  current: number | null | undefined,
  reference: number | null | undefined,
): MetricComparison {
  if (!finite(current)) {
    return {
      referenceValue: finite(reference) ? reference : null,
      absoluteDelta: null,
      percentageDelta: null,
      percentageDeltaReason: "missing_current",
    };
  }
  if (!finite(reference)) {
    return {
      referenceValue: null,
      absoluteDelta: null,
      percentageDelta: null,
      percentageDeltaReason: "missing_reference",
    };
  }
  const absoluteDelta = current - reference;
  if (reference === 0) {
    return {
      referenceValue: reference,
      absoluteDelta,
      percentageDelta: null,
      percentageDeltaReason: "zero_reference",
    };
  }
  return {
    referenceValue: reference,
    absoluteDelta,
    percentageDelta: (absoluteDelta / reference) * 100,
    percentageDeltaReason: null,
  };
}

export function calculateMetricRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): MetricRatioResult {
  if (!finite(numerator)) return { value: null, reason: "missing_numerator" };
  if (!finite(denominator)) return { value: null, reason: "missing_denominator" };
  if (denominator === 0) return { value: null, reason: "zero_denominator" };
  return { value: numerator / denominator, reason: null };
}

export function sumMetricValues(values: readonly (number | null | undefined)[]) {
  const present = values.filter(finite);
  if (!present.length) return { value: null, coverage: "partial" as const, observed: 0, missing: values.length };
  return {
    value: present.reduce((sum, value) => sum + value, 0),
    coverage: present.length === values.length ? "complete" as const : "partial" as const,
    observed: present.length,
    missing: values.length - present.length,
  };
}

export function averageMetricValues(values: readonly (number | null | undefined)[]) {
  const summed = sumMetricValues(values);
  return {
    ...summed,
    value: summed.value === null ? null : summed.value / summed.observed,
  };
}

export function distinctMetricCount(values: readonly (string | number | null | undefined)[]) {
  const present = values.filter((value): value is string | number => value !== null && value !== undefined);
  return {
    value: present.length ? new Set(present).size : null,
    coverage: present.length === values.length ? "complete" as const : "partial" as const,
    observed: present.length,
    missing: values.length - present.length,
  };
}

/** Weighted averages are explicit; average-of-averages is intentionally not provided. */
export function weightedMetricAverage(values: readonly MetricWeightedValue[]) {
  let weightedTotal = 0;
  let totalWeight = 0;
  let missing = 0;
  for (const item of values) {
    if (!finite(item.value) || !finite(item.weight)) {
      missing += 1;
      continue;
    }
    if (item.weight < 0) throw new Error("METRIC_NEGATIVE_WEIGHT");
    weightedTotal += item.value * item.weight;
    totalWeight += item.weight;
  }
  return {
    value: totalWeight > 0 ? weightedTotal / totalWeight : null,
    coverage: missing === 0 ? "complete" as const : "partial" as const,
    totalWeight,
    missing,
  };
}

/** Snapshot semantics select the newest value; snapshots are never summed. */
export function latestMetricSnapshot(points: readonly MetricSnapshotPoint[]) {
  const valid = points
    .filter((point) => finite(point.value) && Number.isFinite(Date.parse(point.dataAsOf)))
    .sort((a, b) => Date.parse(b.dataAsOf) - Date.parse(a.dataAsOf));
  const latest = valid[0];
  return latest ? { value: latest.value as number, dataAsOf: new Date(latest.dataAsOf).toISOString() } : null;
}

export function resolveMetricUnit(
  definition: MetricDefinition,
  workspaceCurrency?: string | null,
): ResolvedMetricUnit {
  const unit = definition.unit;
  if (unit.kind !== "money") return unit;
  const currency = unit.currency === "workspace"
    ? workspaceCurrency
    : unit.currency.code;
  if (!currency) throw new Error(`METRIC_CURRENCY_REQUIRED:${definition.id}`);
  return { kind: "money", currency: normalizeCurrencyCode(currency) };
}

export function assertMetricCurrency(
  unit: ResolvedMetricUnit,
  sourceCurrency?: string | null,
) {
  if (unit.kind !== "money") {
    if (sourceCurrency) throw new Error("METRIC_CURRENCY_ON_NON_MONEY");
    return;
  }
  if (!sourceCurrency) return;
  if (normalizeCurrencyCode(sourceCurrency) !== unit.currency) throw new Error("METRIC_IMPLICIT_FX_FORBIDDEN");
}

export function normalizeMetricCoverage(coverage: MetricCoverage): MetricCoverage {
  if (coverage.ratio !== undefined && (!finite(coverage.ratio) || coverage.ratio < 0 || coverage.ratio > 1)) {
    throw new Error("METRIC_INVALID_COVERAGE_RATIO");
  }
  return Object.freeze({ ...coverage });
}

export function evaluateMetricFreshness(input: {
  dataAsOf?: string | null;
  calculatedAt: string;
  staleAfterSeconds?: number;
}) {
  const calculated = Date.parse(input.calculatedAt);
  if (!Number.isFinite(calculated)) {
    return { state: "unknown" as const, reason: "invalid_timestamp" as const };
  }
  if (!input.dataAsOf) {
    return { state: "unknown" as const, reason: "missing_data_as_of" as const };
  }
  const dataAsOf = Date.parse(input.dataAsOf);
  if (!Number.isFinite(dataAsOf)) {
    return { state: "unknown" as const, reason: "invalid_timestamp" as const };
  }
  const ageSeconds = Math.max(0, (calculated - dataAsOf) / 1000);
  if (!finite(input.staleAfterSeconds) || input.staleAfterSeconds <= 0) {
    return { state: "unknown" as const, ageSeconds, reason: "missing_policy" as const };
  }
  return {
    state: ageSeconds > input.staleAfterSeconds ? "stale" as const : "fresh" as const,
    ageSeconds,
    staleAfterSeconds: input.staleAfterSeconds,
  };
}

export function normalizeMetricResult(input: {
  definition: MetricDefinition;
  adapter: MetricAdapterResult;
  period: MetricPeriod;
  calculatedAt: string;
  workspaceCurrency?: string | null;
  comparisonRequested: boolean;
}): NormalizedMetricResult {
  const definition = validateMetricDefinition(input.definition);
  const period = validateMetricPeriod(input.period);
  const unit = resolveMetricUnit(definition, input.workspaceCurrency);
  assertMetricCurrency(unit, input.adapter.currency);
  if (input.adapter.reference?.currency) assertMetricCurrency(unit, input.adapter.reference.currency);

  const hasValue = finite(input.adapter.value);
  const inferredAvailability = input.adapter.availability ?? {
    state: hasValue ? "available" as const : "missing" as const,
    ...(!hasValue ? { reason: "missing_value" } : {}),
  };
  if (inferredAvailability.state === "available" && !hasValue) {
    throw new Error(`METRIC_AVAILABLE_WITHOUT_VALUE:${definition.id}`);
  }
  if (inferredAvailability.state !== "available" && input.adapter.value !== null && input.adapter.value !== undefined) {
    throw new Error(`METRIC_UNAVAILABLE_WITH_VALUE:${definition.id}`);
  }
  if (definition.valueKind === "integer" && hasValue && !Number.isInteger(input.adapter.value)) {
    throw new Error(`METRIC_INTEGER_REQUIRED:${definition.id}`);
  }

  const calculatedAt = new Date(input.calculatedAt);
  if (!Number.isFinite(calculatedAt.getTime())) throw new Error("METRIC_INVALID_CALCULATED_AT");
  const dataAsOf = input.adapter.dataAsOf
    ? new Date(input.adapter.dataAsOf)
    : null;
  if (dataAsOf && !Number.isFinite(dataAsOf.getTime())) throw new Error(`METRIC_INVALID_DATA_AS_OF:${definition.id}`);

  const shouldCompare = input.comparisonRequested && definition.comparison === "supported";
  return Object.freeze({
    metricId: definition.id,
    definitionVersion: definition.version,
    value: hasValue ? input.adapter.value : null,
    unit,
    period,
    comparison: shouldCompare
      ? calculateMetricComparison(hasValue ? input.adapter.value : null, input.adapter.reference?.value)
      : null,
    dataAsOf: dataAsOf ? dataAsOf.toISOString() : null,
    calculatedAt: calculatedAt.toISOString(),
    provenance: Object.freeze({ ...input.adapter.provenance }),
    coverage: normalizeMetricCoverage(input.adapter.coverage),
    freshness: evaluateMetricFreshness({
      dataAsOf: dataAsOf?.toISOString() ?? null,
      calculatedAt: calculatedAt.toISOString(),
      staleAfterSeconds: input.adapter.staleAfterSeconds,
    }),
    availability: Object.freeze({ ...inferredAvailability }),
  });
}

function canonicalFilterValue(value: MetricFilter["value"]) {
  return Array.isArray(value)
    ? [...value].map(String).sort()
    : String(value);
}

export function canonicalizeMetricFilters(filters: readonly MetricFilter[] = []) {
  return filters
    .map((filter) => {
      if (!FILTER_KEY_PATTERN.test(filter.key)) throw new Error(`METRIC_INVALID_FILTER_KEY:${filter.key}`);
      return { key: filter.key, value: canonicalFilterValue(filter.value) };
    })
    .sort((a, b) => a.key.localeCompare(b.key) || JSON.stringify(a.value).localeCompare(JSON.stringify(b.value)));
}

/**
 * Canonical cache identity only. This does not install cache infrastructure.
 * Tenant identity and definition versions are mandatory to prevent cross-tenant reuse.
 */
export function buildMetricCacheIdentity(input: {
  organizationId: string;
  workspaceId: string;
  service: string;
  definitions: readonly Pick<MetricDefinition, "id" | "version">[];
  period: MetricPeriod;
  filters?: readonly MetricFilter[];
  comparisonPeriod?: MetricPeriod;
  sourceContext?: string;
}) {
  if (!input.organizationId || !input.workspaceId || !input.service) throw new Error("METRIC_CACHE_TENANT_REQUIRED");
  const definitions = [...input.definitions]
    .map((definition) => `${definition.id}@${definition.version}`)
    .sort();
  return JSON.stringify({
    v: 1,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    service: input.service,
    definitions,
    period: validateMetricPeriod(input.period),
    filters: canonicalizeMetricFilters(input.filters),
    comparisonPeriod: input.comparisonPeriod ? validateMetricPeriod(input.comparisonPeriod) : null,
    sourceContext: input.sourceContext ?? null,
  });
}
