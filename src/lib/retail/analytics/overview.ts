import type { MetricDefinition, MetricPeriod, NormalizedMetricResult } from "@/src/lib/dashboard/metrics";
import {
  createMetricRegistry,
  metricPeriodFromDateSelection,
  normalizeMetricResult,
  shiftMetricDate,
} from "@/src/lib/dashboard/metrics/core";
import type { AnalyticsSnapshot } from "@/src/lib/retail/types";

export type RetailOverviewRange = "today" | "7d" | "30d" | "custom";

export type RetailOverviewSelection = Readonly<{
  range: RetailOverviewRange;
  from: string;
  to: string;
  period: ReturnType<typeof metricPeriodFromDateSelection>;
}>;

type RetailMetricId =
  | "retail.net_sales"
  | "retail.estimated_gross_profit"
  | "retail.estimated_operating_result"
  | "retail.invoice_count"
  | "retail.expenses"
  | "retail.average_invoice"
  | "retail.cash_position"
  | "retail.receivables"
  | "retail.payables"
  | "retail.inventory_value";

type RetailMetricDescriptor = Readonly<{
  id: RetailMetricId;
  label: string;
  description: string;
  href: string;
}>;

const definitions = [
  { id: "retail.net_sales", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "supported", sourceCategory: "rpc", semanticIntent: "صافي المبيعات بعد المرتجعات خلال الفترة" },
  { id: "retail.estimated_gross_profit", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "rpc", semanticIntent: "الربح الإجمالي التقديري بعد تكلفة البضاعة بمتوسط التكلفة" },
  { id: "retail.estimated_operating_result", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "rpc", semanticIntent: "الربح الإجمالي التقديري ناقص مصروفات التشغيل خلال الفترة" },
  { id: "retail.invoice_count", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "count", comparison: "none", sourceCategory: "rpc", semanticIntent: "عدد فواتير البيع المكتملة خلال الفترة" },
  { id: "retail.expenses", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "rpc", semanticIntent: "مصروفات التشغيل خلال الفترة" },
  { id: "retail.average_invoice", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "ratio", comparison: "none", sourceCategory: "rpc", semanticIntent: "صافي المبيعات مقسومًا على عدد الفواتير المكتملة" },
  { id: "retail.cash_position", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "snapshot", comparison: "none", sourceCategory: "rpc", semanticIntent: "الرصيد النقدي الحالي عبر حسابات الصندوق" },
  { id: "retail.receivables", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "snapshot", comparison: "none", sourceCategory: "rpc", semanticIntent: "الرصيد الحالي المفتوح لدى العملاء" },
  { id: "retail.payables", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "snapshot", comparison: "none", sourceCategory: "rpc", semanticIntent: "الرصيد الحالي المستحق للموردين" },
  { id: "retail.inventory_value", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "snapshot", comparison: "none", sourceCategory: "rpc", semanticIntent: "قيمة المخزون الحالية على أساس متوسط التكلفة" },
] as const satisfies readonly MetricDefinition[];

export const retailOverviewMetricRegistry = createMetricRegistry(definitions);

export const RETAIL_PRIMARY_METRICS = Object.freeze([
  { id: "retail.net_sales", label: "صافي المبيعات", description: "بعد المرتجعات خلال الفترة", href: "/retail/workspace/reports" },
  { id: "retail.estimated_gross_profit", label: "الربح الإجمالي التقديري", description: "بعد تكلفة البضاعة التقديرية بمتوسط التكلفة", href: "/retail/workspace/reports" },
  { id: "retail.estimated_operating_result", label: "النتيجة التشغيلية التقديرية", description: "الربح الإجمالي التقديري ناقص المصروفات", href: "/retail/workspace/reports" },
  { id: "retail.invoice_count", label: "عدد الفواتير", description: "فواتير البيع المكتملة خلال الفترة", href: "/retail/workspace/reports" },
] as const satisfies readonly RetailMetricDescriptor[]);

export const RETAIL_SUPPORTING_METRICS = Object.freeze([
  { id: "retail.expenses", label: "المصروفات", description: "مصروفات التشغيل خلال الفترة", href: "/retail/workspace/expenses" },
  { id: "retail.average_invoice", label: "متوسط الفاتورة", description: "صافي المبيعات لكل فاتورة مكتملة", href: "/retail/workspace/reports" },
] as const satisfies readonly RetailMetricDescriptor[]);

export const RETAIL_CURRENT_METRICS = Object.freeze([
  { id: "retail.cash_position", label: "الصندوق", description: "الرصيد النقدي الحالي", href: "/retail/workspace/cash" },
  { id: "retail.receivables", label: "ديون العملاء", description: "الرصيد المفتوح لدى العملاء", href: "/retail/workspace/debts" },
  { id: "retail.payables", label: "مستحقات الموردين", description: "الرصيد المفتوح للموردين", href: "/retail/workspace/debts" },
  { id: "retail.inventory_value", label: "قيمة المخزون", description: "القيمة الحالية بمتوسط التكلفة", href: "/retail/workspace/inventory" },
] as const satisfies readonly RetailMetricDescriptor[]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | undefined) {
  return Boolean(value && ISO_DATE.test(value));
}

export function resolveRetailOverviewSelection(input: {
  range?: string;
  from?: string;
  to?: string;
  timezone: string;
  today: string;
}): RetailOverviewSelection {
  let range: RetailOverviewRange = input.range === "today" || input.range === "30d" || input.range === "7d"
    ? input.range
    : "7d";
  let from: string;
  let to = input.today;

  if (validDate(input.from) && validDate(input.to)) {
    range = "custom";
    from = input.from as string;
    to = input.to as string;
  } else if (range === "today") {
    from = input.today;
  } else if (range === "30d") {
    from = shiftMetricDate(input.today, -29);
  } else {
    from = shiftMetricDate(input.today, -6);
  }

  try {
    return Object.freeze({
      range,
      from,
      to,
      period: metricPeriodFromDateSelection({ fromDate: from, toDateInclusive: to, timezone: input.timezone }),
    });
  } catch {
    const fallbackFrom = shiftMetricDate(input.today, -6);
    return Object.freeze({
      range: "7d" as const,
      from: fallbackFrom,
      to: input.today,
      period: metricPeriodFromDateSelection({ fromDate: fallbackFrom, toDateInclusive: input.today, timezone: input.timezone }),
    });
  }
}

function metricValue(snapshot: AnalyticsSnapshot, id: RetailMetricId) {
  const values: Record<RetailMetricId, number> = {
    "retail.net_sales": snapshot.metrics.revenue,
    "retail.estimated_gross_profit": snapshot.metrics.estimated_gross_profit,
    "retail.estimated_operating_result": snapshot.metrics.estimated_net_operating_result,
    "retail.invoice_count": snapshot.metrics.orders,
    "retail.expenses": snapshot.metrics.expenses,
    "retail.average_invoice": snapshot.metrics.average_order_value,
    "retail.cash_position": snapshot.metrics.cash_position,
    "retail.receivables": snapshot.metrics.receivables,
    "retail.payables": snapshot.metrics.payables,
    "retail.inventory_value": snapshot.metrics.inventory_value,
  };
  return values[id];
}

function normalizedRetailMetric(
  snapshot: AnalyticsSnapshot,
  id: RetailMetricId,
  period: MetricPeriod,
  comparison: Parameters<typeof normalizeMetricResult>[0]["comparison"] = null,
): NormalizedMetricResult {
  const definition = retailOverviewMetricRegistry.require(id);
  const hasRevenueReference = id === "retail.net_sales" && comparison !== null;
  return normalizeMetricResult({
    definition,
    adapter: {
      value: metricValue(snapshot, id),
      coverage: { state: "complete" },
      // `as_of` is calculation/read time, not business-level source freshness.
      dataAsOf: null,
      provenance: { category: "rpc", source: "retail_analytics_snapshot" },
      reference: hasRevenueReference
        ? { value: snapshot.comparison.previous_revenue, currency: snapshot.currency }
        : undefined,
      currency: definition.unit.kind === "money" ? snapshot.currency : undefined,
    },
    period,
    calculatedAt: snapshot.as_of,
    workspaceCurrency: snapshot.currency,
    comparison,
  });
}

function normalizedPerformanceMetric(
  snapshot: AnalyticsSnapshot,
  selection: RetailOverviewSelection,
  id: RetailMetricId,
): NormalizedMetricResult {
  const comparison = id === "retail.net_sales"
    ? {
        kind: "previous" as const,
        period: metricPeriodFromDateSelection({
          fromDate: snapshot.comparison.previous_from,
          toDateInclusive: snapshot.comparison.previous_to,
          timezone: snapshot.timezone,
        }),
      }
    : null;
  return normalizedRetailMetric(snapshot, id, selection.period, comparison);
}

function localDateForInstant(value: string, timezone: string) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error("RETAIL_ANALYTICS_INVALID_AS_OF");
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  if (!year || !month || !day) throw new Error("RETAIL_ANALYTICS_INVALID_AS_OF");
  return `${year}-${month}-${day}`;
}

/**
 * Snapshot metrics receive a Phase 4 period contract for the local day of the
 * read itself. The selected performance period never changes their business
 * meaning; it remains only a structural query context required by Phase 4.
 */
function currentStateMetricPeriod(snapshot: AnalyticsSnapshot) {
  const date = localDateForInstant(snapshot.as_of, snapshot.timezone);
  return metricPeriodFromDateSelection({
    fromDate: date,
    toDateInclusive: date,
    timezone: snapshot.timezone,
  });
}

function normalizedCurrentStateMetric(snapshot: AnalyticsSnapshot, id: RetailMetricId) {
  return normalizedRetailMetric(snapshot, id, currentStateMetricPeriod(snapshot));
}

export type RetailOverviewModel = Readonly<{
  primary: Readonly<Record<(typeof RETAIL_PRIMARY_METRICS)[number]["id"], NormalizedMetricResult>>;
  supporting: Readonly<Record<(typeof RETAIL_SUPPORTING_METRICS)[number]["id"], NormalizedMetricResult>>;
  current: Readonly<Record<(typeof RETAIL_CURRENT_METRICS)[number]["id"], NormalizedMetricResult>>;
  trend: ReadonlyArray<{ label: string; netSales: number }>;
  criticalInventory: ReadonlyArray<AnalyticsSnapshot["low_stock"][number]>;
  attentionInventory: ReadonlyArray<AnalyticsSnapshot["low_stock"][number]>;
  topProducts: ReadonlyArray<AnalyticsSnapshot["top_products"][number]>;
  calculatedAt: string;
}>;

export function buildRetailOverviewModel(
  snapshot: AnalyticsSnapshot,
  selection: RetailOverviewSelection,
): RetailOverviewModel {
  const primary = Object.fromEntries(
    RETAIL_PRIMARY_METRICS.map((item) => [item.id, normalizedPerformanceMetric(snapshot, selection, item.id)]),
  ) as RetailOverviewModel["primary"];
  const supporting = Object.fromEntries(
    RETAIL_SUPPORTING_METRICS.map((item) => [item.id, normalizedPerformanceMetric(snapshot, selection, item.id)]),
  ) as RetailOverviewModel["supporting"];
  const current = Object.fromEntries(
    RETAIL_CURRENT_METRICS.map((item) => [item.id, normalizedCurrentStateMetric(snapshot, item.id)]),
  ) as RetailOverviewModel["current"];

  return Object.freeze({
    primary: Object.freeze(primary),
    supporting: Object.freeze(supporting),
    current: Object.freeze(current),
    trend: Object.freeze(snapshot.daily_sales.map((item) => ({ label: item.day, netSales: item.revenue }))),
    criticalInventory: Object.freeze(snapshot.low_stock.filter((item) => item.stock_on_hand === 0)),
    attentionInventory: Object.freeze(snapshot.low_stock.filter((item) => item.stock_on_hand > 0 && item.stock_on_hand <= item.minimum_stock)),
    topProducts: Object.freeze([...snapshot.top_products]),
    calculatedAt: snapshot.as_of,
  });
}