import type { AnalyticsSnapshot } from "@/src/lib/retail/types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`RETAIL_ANALYTICS_INVALID_OBJECT:${path}`);
  }
  return value as UnknownRecord;
}

function text(value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`RETAIL_ANALYTICS_INVALID_TEXT:${path}`);
  }
  return value;
}

function nullableText(value: unknown, path: string) {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`RETAIL_ANALYTICS_INVALID_TEXT:${path}`);
  return value;
}

function finiteNumber(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`RETAIL_ANALYTICS_INVALID_NUMBER:${path}`);
  }
  return value;
}

function nullableFiniteNumber(value: unknown, path: string) {
  if (value === null) return null;
  return finiteNumber(value, path);
}

function integer(value: unknown, path: string) {
  const result = finiteNumber(value, path);
  if (!Number.isInteger(result)) throw new Error(`RETAIL_ANALYTICS_INVALID_INTEGER:${path}`);
  return result;
}

function array(value: unknown, path: string) {
  if (!Array.isArray(value)) throw new Error(`RETAIL_ANALYTICS_INVALID_ARRAY:${path}`);
  return value;
}

function stableMetric(raw: UnknownRecord, stableKey: string, rpcKey = stableKey) {
  // The authoritative RPC key wins whenever it exists, even when its value is
  // null/undefined/invalid. Legacy fallback is compatibility for an absent key,
  // never a way to hide a contract failure returned by the authoritative shape.
  const hasAuthoritativeKey = Object.prototype.hasOwnProperty.call(raw, rpcKey);
  const value = hasAuthoritativeKey ? raw[rpcKey] : raw[stableKey];
  return finiteNumber(value, `metrics.${rpcKey}`);
}

/**
 * The PostgreSQL RPC is the source boundary. This adapter is the only place that
 * knows its raw key names; consumers receive one stable AnalyticsSnapshot shape.
 * Missing/invalid required values throw instead of becoming a fabricated zero.
 */
export function normalizeRetailAnalyticsSnapshot(input: unknown): AnalyticsSnapshot {
  const source = record(input, "snapshot");
  const rawMetrics = record(source.metrics, "metrics");
  const rawPeriod = record(source.period, "period");
  const rawComparison = record(source.comparison, "comparison");

  const metrics: AnalyticsSnapshot["metrics"] = {
    revenue: stableMetric(rawMetrics, "revenue"),
    gross_sales: stableMetric(rawMetrics, "gross_sales"),
    returns: stableMetric(rawMetrics, "returns"),
    estimated_cost_of_goods: stableMetric(rawMetrics, "estimated_cost_of_goods"),
    estimated_gross_profit: stableMetric(rawMetrics, "estimated_gross_profit"),
    expenses: stableMetric(rawMetrics, "expenses", "retail_expenses"),
    estimated_net_operating_result: stableMetric(rawMetrics, "estimated_net_operating_result"),
    orders: integer(rawMetrics.orders, "metrics.orders"),
    average_order_value: stableMetric(rawMetrics, "average_order_value"),
    cash_position: stableMetric(rawMetrics, "cash_position"),
    cash_in: stableMetric(rawMetrics, "cash_in"),
    cash_out: stableMetric(rawMetrics, "cash_out"),
    receivables: stableMetric(rawMetrics, "receivables", "retail_receivables"),
    payables: stableMetric(rawMetrics, "payables", "retail_payables"),
    inventory_value: stableMetric(rawMetrics, "inventory_value"),
  };

  const comparison: AnalyticsSnapshot["comparison"] = {
    previous_from: text(rawComparison.previous_from, "comparison.previous_from"),
    previous_to: text(rawComparison.previous_to, "comparison.previous_to"),
    previous_revenue: finiteNumber(rawComparison.previous_revenue, "comparison.previous_revenue"),
    revenue_change: finiteNumber(rawComparison.revenue_change, "comparison.revenue_change"),
    revenue_change_percent: nullableFiniteNumber(
      rawComparison.revenue_change_percent,
      "comparison.revenue_change_percent",
    ),
  };

  const top_products: AnalyticsSnapshot["top_products"] = array(source.top_products, "top_products").map((item, index) => {
    const row = record(item, `top_products.${index}`);
    return {
      id: text(row.id, `top_products.${index}.id`),
      name: text(row.name, `top_products.${index}.name`),
      sku: nullableText(row.sku, `top_products.${index}.sku`),
      quantity_sold: finiteNumber(row.quantity_sold, `top_products.${index}.quantity_sold`),
      revenue: finiteNumber(row.revenue, `top_products.${index}.revenue`),
    };
  });

  const low_stock: AnalyticsSnapshot["low_stock"] = array(source.low_stock, "low_stock").map((item, index) => {
    const row = record(item, `low_stock.${index}`);
    return {
      id: text(row.id, `low_stock.${index}.id`),
      name: text(row.name, `low_stock.${index}.name`),
      sku: nullableText(row.sku, `low_stock.${index}.sku`),
      stock_on_hand: finiteNumber(row.stock_on_hand, `low_stock.${index}.stock_on_hand`),
      minimum_stock: finiteNumber(row.minimum_stock, `low_stock.${index}.minimum_stock`),
    };
  });

  const slow_moving: AnalyticsSnapshot["slow_moving"] = array(source.slow_moving, "slow_moving").map((item, index) => {
    const row = record(item, `slow_moving.${index}`);
    return {
      id: text(row.id, `slow_moving.${index}.id`),
      name: text(row.name, `slow_moving.${index}.name`),
      sku: nullableText(row.sku, `slow_moving.${index}.sku`),
      stock_on_hand: finiteNumber(row.stock_on_hand, `slow_moving.${index}.stock_on_hand`),
      last_sold_at: nullableText(row.last_sold_at, `slow_moving.${index}.last_sold_at`),
      quantity_30d: finiteNumber(row.quantity_30d, `slow_moving.${index}.quantity_30d`),
    };
  });

  const daily_sales: AnalyticsSnapshot["daily_sales"] = array(source.daily_sales, "daily_sales").map((item, index) => {
    const row = record(item, `daily_sales.${index}`);
    return {
      day: text(row.day, `daily_sales.${index}.day`),
      revenue: finiteNumber(row.revenue, `daily_sales.${index}.revenue`),
    };
  });

  const recent_activity: AnalyticsSnapshot["recent_activity"] = array(source.recent_activity, "recent_activity").map((item, index) => {
    const row = record(item, `recent_activity.${index}`);
    return {
      kind: text(row.kind, `recent_activity.${index}.kind`),
      id: text(row.id, `recent_activity.${index}.id`),
      label: text(row.label, `recent_activity.${index}.label`),
      amount: finiteNumber(row.amount, `recent_activity.${index}.amount`),
      occurred_at: text(row.occurred_at, `recent_activity.${index}.occurred_at`),
    };
  });

  const rawDefinitions = record(source.definitions, "definitions");
  const definitions = Object.fromEntries(
    Object.entries(rawDefinitions).map(([key, value]) => [key, text(value, `definitions.${key}`)]),
  );

  return Object.freeze({
    workspace_id: text(source.workspace_id, "workspace_id"),
    currency: text(source.currency, "currency"),
    timezone: text(source.timezone, "timezone"),
    as_of: text(source.as_of, "as_of"),
    period: Object.freeze({
      from: text(rawPeriod.from, "period.from"),
      to: text(rawPeriod.to, "period.to"),
      days: integer(rawPeriod.days, "period.days"),
    }),
    metrics: Object.freeze(metrics),
    comparison: Object.freeze(comparison),
    top_products,
    low_stock,
    slow_moving,
    daily_sales,
    recent_activity,
    definitions: Object.freeze(definitions),
  });
}