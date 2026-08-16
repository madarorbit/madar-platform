import type {
  MetricAvailability,
  MetricDefinition,
  MetricPeriod,
  NormalizedMetricResult,
} from "../../dashboard/metrics/contracts.ts";
import {
  calculateMetricRatio,
  createMetricRegistry,
  metricPeriodFromDateSelection,
  normalizeMetricResult,
} from "../../dashboard/metrics/core.ts";

export type NativeVertical = "commerce" | "food_service" | "hospitality";

export type NativeSection<T> = Readonly<{
  data: T | null;
  failed: boolean;
}>;

export type NativeMoneyBucket = Readonly<{
  currency: string;
  amount: number;
  dataAsOf: string | null;
}>;

export type NativeCommerceSalesBucket = NativeMoneyBucket & Readonly<{
  completedSalesCount: number;
}>;

export type NativeStockItem = Readonly<{
  id: string;
  name: string;
  stockQuantity: number;
  lowStockThreshold: number;
}>;

export type NativeCommerceFacts = Readonly<{
  kind: "commerce";
  salesByCurrency: readonly NativeCommerceSalesBucket[];
  cogsByCurrency: readonly NativeMoneyBucket[];
  returnsByCurrency: readonly NativeMoneyBucket[];
  expensesByCurrency: readonly NativeMoneyBucket[];
  inventory: Readonly<{
    activeProductCount: number;
    inventoryValue: number;
    stockOutCount: number;
    lowStockCount: number;
    dataAsOf: string | null;
    stockOutSample: readonly NativeStockItem[];
    lowStockSample: readonly NativeStockItem[];
  }>;
}>;

export type NativeKitchenTicket = Readonly<{
  id: string;
  ticketNumber: string;
  status: string;
  priority: string;
  openedAt: string;
}>;

export type NativeFoodFacts = Readonly<{
  kind: "food_service";
  orderCount: number;
  recipeCount: number;
  completedOrders: number;
  revenue: number;
  ingredientCost: number;
  grossProfit: number;
  ordersDataAsOf: string | null;
  kitchen: Readonly<{
    activeCount: number;
    attentionCount: number;
    averageTicketMinutes: number | null;
    dataAsOf: string | null;
    attentionSample: readonly NativeKitchenTicket[];
  }>;
  ingredients: Readonly<{
    ingredientProductCount: number;
    stockOutCount: number;
    lowStockCount: number;
    dataAsOf: string | null;
    stockOutSample: readonly NativeStockItem[];
    lowStockSample: readonly NativeStockItem[];
  }>;
}>;

export type NativeHousekeepingItem = Readonly<{
  id: string;
  roomNumber: string;
  taskType: string;
  status: string;
  serviceDate: string;
}>;

export type NativeMaintenanceItem = Readonly<{
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
}>;

export type NativeHospitalityFacts = Readonly<{
  kind: "hospitality";
  propertyCount: number;
  propertyTimezones: readonly string[];
  invalidTimezoneCount: number;
  totalRooms: number;
  occupiedRooms: number;
  roomRevenueByCurrency: readonly NativeMoneyBucket[];
  inHouseStays: number;
  housekeeping: Readonly<{
    activeCount: number;
    blockedCount: number;
    blockedSample: readonly NativeHousekeepingItem[];
  }>;
  maintenance: Readonly<{
    activeCount: number;
    emergencyCount: number;
    highCount: number;
    emergencySample: readonly NativeMaintenanceItem[];
    highSample: readonly NativeMaintenanceItem[];
  }>;
}>;

export type NativeVerticalFacts = NativeCommerceFacts | NativeFoodFacts | NativeHospitalityFacts;

export type NativeTaskItem = Readonly<{
  id: string;
  title: string;
  priority: string;
  dueAt: string;
}>;

export type NativeTaskFacts = Readonly<{
  overdueCount: number;
  highUrgentOverdueCount: number;
  dataAsOf: string | null;
  overdueSample: readonly NativeTaskItem[];
}>;

export type NativeDashboardData = Readonly<{
  organizationCreatedAt: string | null;
  facts: NativeSection<NativeVerticalFacts>;
  tasks: NativeSection<NativeTaskFacts>;
}>;

export type NativeOverviewContext = Readonly<{
  currency: string;
  setupStatus: "not_started" | "in_progress" | "ready" | "blocked";
  extension: NativeVertical;
  specializationName: string;
  enabledModules: readonly string[];
}>;

export type NativeMetricView = Readonly<{
  result: NormalizedMetricResult;
  label: string;
  timeContext: "تراكمي" | "اليوم" | "حاليًا";
  href: string;
  detail?: string;
  status?: string;
}>;

export type NativeAttentionItem = Readonly<{
  severity: "critical" | "attention";
  title: string;
  description: string;
  href: string;
  samples?: readonly string[];
}>;

export type NativeStatusNotice = Readonly<{
  tone: "info" | "warning";
  title: string;
  description: string;
  href: string;
}>;

export type NativeOverviewModel = Readonly<{
  vertical: NativeVertical;
  setupRequired: boolean;
  coreModule: string;
  isFirstUse: boolean;
  isPartial: boolean;
  failedSources: readonly string[];
  primary: readonly NativeMetricView[];
  current: readonly NativeMetricView[];
  supporting: readonly NativeMetricView[];
  critical: readonly NativeAttentionItem[];
  attention: readonly NativeAttentionItem[];
  notices: readonly NativeStatusNotice[];
}>;

const commerceDefinitions = [
  { id: "native.commerce.completed_sales_count", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "count", comparison: "none", sourceCategory: "madar_native", semanticIntent: "عدد عمليات البيع المكتملة تراكميًا" },
  { id: "native.commerce.sales_amount", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "madar_native", semanticIntent: "قيمة عمليات البيع المكتملة تراكميًا دون تحويل عملات" },
  { id: "native.commerce.inventory_value", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "snapshot", comparison: "none", sourceCategory: "derived", semanticIntent: "قيمة المخزون الحالية من الكمية الحالية مضروبة في تكلفة الصنف" },
  { id: "native.commerce.cogs", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "derived", semanticIntent: "تكلفة بنود عمليات البيع المكتملة تراكميًا" },
  { id: "native.commerce.expenses", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "madar_native", semanticIntent: "المصروفات المسجلة تراكميًا حسب عملتها الأصلية" },
  { id: "native.commerce.returns", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "derived", semanticIntent: "قيمة مرتجعات البيع المرحلة تراكميًا حسب عملة عملية البيع" },
  { id: "native.commerce.stock_out_count", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "عدد الأصناف النشطة ذات مخزون صفري الآن" },
  { id: "native.commerce.low_stock_count", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "عدد الأصناف النشطة الواقعة عند أو تحت حد المخزون المنخفض المعرّف لها" },
] as const satisfies readonly MetricDefinition[];

const foodDefinitions = [
  { id: "native.food.completed_orders", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "count", comparison: "none", sourceCategory: "madar_native", semanticIntent: "طلبات المطعم التي وصلت إلى SERVED أو COMPLETED فقط" },
  { id: "native.food.revenue", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "madar_native", semanticIntent: "إيراد الطلبات المخدومة أو المكتملة فقط" },
  { id: "native.food.gross_profit", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "derived", semanticIntent: "إيراد الطلبات المخدومة أو المكتملة ناقص تكلفة مكوناتها" },
  { id: "native.food.ingredient_cost", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "madar_native", semanticIntent: "تكلفة مكونات الطلبات المخدومة أو المكتملة" },
  { id: "native.food.kitchen_workload", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "تذاكر المطبخ الحالية NEW أو PREPARING أو READY" },
  { id: "native.food.avg_ticket_minutes", version: "1", valueKind: "number", unit: { kind: "duration", unit: "minutes" }, aggregation: "average", comparison: "none", sourceCategory: "derived", semanticIntent: "متوسط الزمن من فتح التذكرة حتى ready_at للتذاكر التي وصلت إلى الجاهزية" },
  { id: "native.food.kitchen_attention_count", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "تذاكر المطبخ النشطة ذات أولوية HIGH أو URGENT" },
  { id: "native.food.ingredient_stock_out_count", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "derived", semanticIntent: "مكونات مستخدمة في وصفات نشطة ذات مخزون صفري" },
  { id: "native.food.ingredient_low_stock_count", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "derived", semanticIntent: "مكونات وصفات نشطة عند أو تحت حد المخزون المنخفض" },
] as const satisfies readonly MetricDefinition[];

const hospitalityDefinitions = [
  { id: "native.hotel.total_rooms", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "إجمالي الغرف في جميع المنشآت الفندقية النشطة للمنظمة" },
  { id: "native.hotel.occupied_rooms", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "إجمالي الغرف الحالية ذات حالة OCCUPIED عبر جميع المنشآت" },
  { id: "native.hotel.occupancy", version: "1", valueKind: "number", unit: { kind: "percentage" }, aggregation: "ratio", comparison: "none", sourceCategory: "derived", semanticIntent: "sum occupied rooms / sum total rooms عبر المنظمة، وليس متوسط نسب المنشآت" },
  { id: "native.hotel.room_revenue_today", version: "1", valueKind: "number", unit: { kind: "money", currency: "workspace" }, aggregation: "sum", comparison: "none", sourceCategory: "derived", semanticIntent: "رسوم الغرف المنشورة في اليوم المحلي للمنشأة، وتعرض فقط عندما يكون السياق الزمني والعملة قابلين للتوحيد بأمان" },
  { id: "native.hotel.in_house_stays", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "الإقامات الحالية IN_HOUSE عبر المنشآت النشطة" },
  { id: "native.hotel.housekeeping_active", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "مهام التنظيف الحالية غير المكتملة" },
  { id: "native.hotel.housekeeping_blocked", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "مهام التنظيف الحالية ذات حالة BLOCKED" },
  { id: "native.hotel.maintenance_active", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "طلبات الصيانة الحالية OPEN أو ASSIGNED أو IN_PROGRESS" },
  { id: "native.hotel.maintenance_emergency", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "طلبات الصيانة الحالية ذات أولوية EMERGENCY" },
  { id: "native.hotel.maintenance_high", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "طلبات الصيانة الحالية ذات أولوية HIGH" },
] as const satisfies readonly MetricDefinition[];

const sharedDefinitions = [
  { id: "native.tasks.overdue", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "المهام المفتوحة التي تجاوز due_at الآن" },
  { id: "native.tasks.high_urgent_overdue", version: "1", valueKind: "integer", unit: { kind: "count" }, aggregation: "snapshot", comparison: "none", sourceCategory: "madar_native", semanticIntent: "المهام المتأخرة ذات أولوية high أو urgent" },
] as const satisfies readonly MetricDefinition[];

export const nativeOverviewMetricRegistry = createMetricRegistry([
  ...commerceDefinitions,
  ...foodDefinitions,
  ...hospitalityDefinitions,
  ...sharedDefinitions,
]);

export function nativeCoreModule(vertical: NativeVertical) {
  if (vertical === "food_service") return "restaurant";
  if (vertical === "hospitality") return "hotel";
  return "sales";
}

export function nativeSetupRequired(context: NativeOverviewContext) {
  return context.setupStatus !== "ready" || !context.enabledModules.includes(nativeCoreModule(context.extension));
}

function isoInstant(value: string, error: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(error);
  return new Date(parsed).toISOString();
}

function cumulativePeriod(start: string, calculatedAt: string): MetricPeriod {
  const from = isoInstant(start, "NATIVE_INVALID_ORGANIZATION_START");
  const calculated = Date.parse(calculatedAt);
  if (!Number.isFinite(calculated)) throw new Error("NATIVE_INVALID_CALCULATED_AT");
  const to = new Date(calculated + 1).toISOString();
  if (Date.parse(from) >= Date.parse(to)) throw new Error("NATIVE_INVALID_CUMULATIVE_PERIOD");
  return Object.freeze({ fromInclusive: from, toExclusive: to, timezone: "UTC" });
}

function snapshotPeriod(calculatedAt: string): MetricPeriod {
  const date = isoInstant(calculatedAt, "NATIVE_INVALID_CALCULATED_AT").slice(0, 10);
  return metricPeriodFromDateSelection({ fromDate: date, toDateInclusive: date, timezone: "UTC" });
}

function localDate(instant: string, timezone: string) {
  const parsed = new Date(isoInstant(instant, "NATIVE_INVALID_CALCULATED_AT"));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = pick("year"), month = pick("month"), day = pick("day");
  if (!year || !month || !day) throw new Error("NATIVE_INVALID_LOCAL_DATE");
  return `${year}-${month}-${day}`;
}

function localTodayPeriod(calculatedAt: string, timezone: string) {
  const date = localDate(calculatedAt, timezone);
  return metricPeriodFromDateSelection({ fromDate: date, toDateInclusive: date, timezone });
}

function moneyDefinition(metricId: string, currency: string | null) {
  const base = nativeOverviewMetricRegistry.require(metricId);
  if (!currency || base.unit.kind !== "money") return base;
  return Object.freeze({ ...base, unit: { kind: "money", currency: { code: currency } } }) satisfies MetricDefinition;
}

function normalizedMetric(input: {
  id: string;
  value: number | null | undefined;
  period: MetricPeriod;
  calculatedAt: string;
  workspaceCurrency: string;
  dataAsOf?: string | null;
  source: string;
  currency?: string | null;
  availability?: MetricAvailability;
  coverage?: { state: "complete" | "partial"; ratio?: number; reason?: string };
}) {
  const definition = input.currency
    ? moneyDefinition(input.id, input.currency)
    : nativeOverviewMetricRegistry.require(input.id);
  return normalizeMetricResult({
    definition,
    adapter: {
      value: input.value,
      availability: input.availability,
      coverage: input.coverage ?? { state: "complete" },
      dataAsOf: input.dataAsOf ?? null,
      provenance: { category: definition.sourceCategory ?? "madar_native", source: input.source },
      ...(definition.unit.kind === "money" && input.currency ? { currency: input.currency } : {}),
    },
    period: input.period,
    calculatedAt: input.calculatedAt,
    workspaceCurrency: input.workspaceCurrency,
  });
}

function latestDataAsOf(rows: readonly NativeMoneyBucket[]) {
  const timestamps = rows.map((row) => row.dataAsOf).filter((value): value is string => Boolean(value)).map(Date.parse).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function collapseMoney(rows: readonly NativeMoneyBucket[], workspaceCurrency: string) {
  if (!rows.length) return { value: 0, currency: workspaceCurrency, currencies: [] as string[], dataAsOf: null, safe: true };
  if (rows.length === 1) return { value: rows[0].amount, currency: rows[0].currency, currencies: [rows[0].currency], dataAsOf: rows[0].dataAsOf, safe: true };
  return { value: null, currency: null, currencies: rows.map((row) => row.currency).sort(), dataAsOf: latestDataAsOf(rows), safe: false };
}

function sampleNames(items: readonly NativeStockItem[]) {
  return items.map((item) => item.name);
}

function taskAttention(context: NativeOverviewContext, data: NativeDashboardData, calculatedAt: string, current: NativeMetricView[], attention: NativeAttentionItem[]) {
  if (!context.enabledModules.includes("tasks")) return;
  if (data.tasks.failed || !data.tasks.data) return;
  const tasks = data.tasks.data;
  const period = snapshotPeriod(calculatedAt);
  current.push({
    label: "المهام المتأخرة",
    timeContext: "حاليًا",
    href: "/workspace/tasks",
    result: normalizedMetric({ id: "native.tasks.overdue", value: tasks.overdueCount, period, calculatedAt, workspaceCurrency: context.currency, dataAsOf: tasks.dataAsOf, source: "business_tasks" }),
  });
  if (tasks.overdueCount > 0) {
    attention.push({
      severity: "attention",
      title: tasks.highUrgentOverdueCount > 0 ? `${tasks.highUrgentOverdueCount} مهام عالية/عاجلة متأخرة` : `${tasks.overdueCount} مهام متأخرة`,
      description: "المهمة تصبح Attention لأنها تجاوزت due_at وهي ما تزال مفتوحة؛ الأولوية العالية أو العاجلة ترفع أولوية المتابعة ولا تتحول تلقائيًا إلى Critical.",
      href: "/workspace/tasks",
      samples: tasks.overdueSample.map((task) => task.title),
    });
  }
}

function emptyModel(context: NativeOverviewContext, data: NativeDashboardData): NativeOverviewModel {
  return {
    vertical: context.extension,
    setupRequired: nativeSetupRequired(context),
    coreModule: nativeCoreModule(context.extension),
    isFirstUse: false,
    isPartial: data.facts.failed || (context.enabledModules.includes("tasks") && data.tasks.failed),
    failedSources: [data.facts.failed ? "vertical_facts" : null, context.enabledModules.includes("tasks") && data.tasks.failed ? "tasks" : null].filter((value): value is string => Boolean(value)),
    primary: [], current: [], supporting: [], critical: [], attention: [], notices: [],
  };
}

function buildCommerce(context: NativeOverviewContext, data: NativeDashboardData, facts: NativeCommerceFacts, calculatedAt: string) {
  const model = emptyModel(context, data);
  const primary: NativeMetricView[] = [];
  const current: NativeMetricView[] = [];
  const supporting: NativeMetricView[] = [];
  const critical: NativeAttentionItem[] = [];
  const attention: NativeAttentionItem[] = [];
  const notices: NativeStatusNotice[] = [];
  const cumulative = cumulativePeriod(data.organizationCreatedAt!, calculatedAt);
  const snapshot = snapshotPeriod(calculatedAt);

  if (context.enabledModules.includes("sales")) {
    const salesCount = facts.salesByCurrency.reduce((sum, item) => sum + item.completedSalesCount, 0);
    const salesMoney = collapseMoney(facts.salesByCurrency, context.currency);
    primary.push({
      label: "عمليات البيع المكتملة",
      timeContext: "تراكمي",
      href: "/workspace/sales",
      result: normalizedMetric({ id: "native.commerce.completed_sales_count", value: salesCount, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: latestDataAsOf(facts.salesByCurrency), source: "business_sales" }),
    });
    if (salesMoney.safe) {
      primary.unshift({
        label: "المبيعات",
        timeContext: "تراكمي",
        href: "/workspace/sales",
        result: normalizedMetric({ id: "native.commerce.sales_amount", value: salesMoney.value, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: salesMoney.dataAsOf, source: "business_sales", currency: salesMoney.currency }),
      });
    } else {
      notices.push({ tone: "warning", title: "المبيعات موزعة على أكثر من عملة", description: `العملات الموجودة: ${salesMoney.currencies.join("، ")}. لا تجمع مَدار هذه القيم ولا تنفذ تحويل FX ضمن النظرة العامة.`, href: "/workspace/sales" });
    }

    const cogs = collapseMoney(facts.cogsByCurrency, context.currency);
    if (cogs.safe) supporting.push({ label: "تكلفة المبيعات المكتملة", timeContext: "تراكمي", href: "/workspace/sales", result: normalizedMetric({ id: "native.commerce.cogs", value: cogs.value, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: cogs.dataAsOf, source: "business_sale_items", currency: cogs.currency }) });
    else notices.push({ tone: "warning", title: "تكلفة المبيعات متعددة العملات", description: `لا يوجد إجمالي موحد آمن لـ ${cogs.currencies.join("، ")} دون FX.`, href: "/workspace/sales" });

    const returns = collapseMoney(facts.returnsByCurrency, context.currency);
    if (returns.safe) supporting.push({ label: "المرتجعات المرحلة", timeContext: "تراكمي", href: "/workspace/sales", result: normalizedMetric({ id: "native.commerce.returns", value: returns.value, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: returns.dataAsOf, source: "commerce_sales_returns", currency: returns.currency }) });
    else notices.push({ tone: "warning", title: "المرتجعات متعددة العملات", description: `لا يتم جمع ${returns.currencies.join("، ")} ضمن رقم واحد.`, href: "/workspace/sales" });
  }

  if (context.enabledModules.includes("expenses")) {
    const expenses = collapseMoney(facts.expensesByCurrency, context.currency);
    if (expenses.safe) supporting.push({ label: "المصروفات", timeContext: "تراكمي", href: "/workspace/expenses", result: normalizedMetric({ id: "native.commerce.expenses", value: expenses.value, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: expenses.dataAsOf, source: "business_expenses", currency: expenses.currency }) });
    else notices.push({ tone: "warning", title: "المصروفات متعددة العملات", description: `القيم مسجلة بـ ${expenses.currencies.join("، ")}؛ لا يوجد جمع أو تحويل ضمن Phase 7.`, href: "/workspace/expenses" });
  }

  if (context.enabledModules.includes("inventory")) {
    const inventory = facts.inventory;
    current.push({
      label: "قيمة المخزون",
      timeContext: "حاليًا",
      href: "/workspace/inventory",
      detail: "تكلفة الصنف في Native Commerce تُخزن دون حقل عملة مستقل؛ لذلك تُقرأ بعقد عملة المساحة نفسها.",
      result: normalizedMetric({ id: "native.commerce.inventory_value", value: inventory.inventoryValue, period: snapshot, calculatedAt, workspaceCurrency: context.currency, dataAsOf: inventory.dataAsOf, source: "business_products", currency: context.currency }),
    });
    normalizedMetric({ id: "native.commerce.stock_out_count", value: inventory.stockOutCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, dataAsOf: inventory.dataAsOf, source: "business_products" });
    normalizedMetric({ id: "native.commerce.low_stock_count", value: inventory.lowStockCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, dataAsOf: inventory.dataAsOf, source: "business_products" });
    if (inventory.stockOutCount > 0) critical.push({ severity: "critical", title: `${inventory.stockOutCount} أصناف نفد مخزونها`, description: "stock_quantity = 0 حقيقة تشغيلية تمنع البيع من المخزون الحالي.", href: "/workspace/inventory", samples: sampleNames(inventory.stockOutSample) });
    if (inventory.lowStockCount > 0) attention.push({ severity: "attention", title: `${inventory.lowStockCount} أصناف عند حد المخزون المنخفض`, description: "التصنيف يستخدم low_stock_threshold المخزنة للصنف نفسه؛ لا توجد عتبة عامة مخترعة.", href: "/workspace/inventory", samples: sampleNames(inventory.lowStockSample) });
  }

  taskAttention(context, data, calculatedAt, current, attention);
  const salesCount = facts.salesByCurrency.reduce((sum, item) => sum + item.completedSalesCount, 0);
  const isFirstUse = facts.inventory.activeProductCount === 0 && salesCount === 0;
  return Object.freeze({ ...model, isFirstUse, primary: Object.freeze(primary), current: Object.freeze(current), supporting: Object.freeze(supporting), critical: Object.freeze(critical), attention: Object.freeze(attention), notices: Object.freeze(notices) });
}

function buildFood(context: NativeOverviewContext, data: NativeDashboardData, facts: NativeFoodFacts, calculatedAt: string) {
  const model = emptyModel(context, data);
  const primary: NativeMetricView[] = [];
  const current: NativeMetricView[] = [];
  const supporting: NativeMetricView[] = [];
  const critical: NativeAttentionItem[] = [];
  const attention: NativeAttentionItem[] = [];
  const notices: NativeStatusNotice[] = [];
  const cumulative = cumulativePeriod(data.organizationCreatedAt!, calculatedAt);
  const snapshot = snapshotPeriod(calculatedAt);

  if (context.enabledModules.includes("restaurant")) {
    primary.push(
      { label: "الطلبات المخدومة/المكتملة", timeContext: "تراكمي", href: "/workspace/restaurant", result: normalizedMetric({ id: "native.food.completed_orders", value: facts.completedOrders, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.ordersDataAsOf, source: "restaurant_orders" }) },
      { label: "إيراد الطلبات المكتملة", timeContext: "تراكمي", href: "/workspace/restaurant", result: normalizedMetric({ id: "native.food.revenue", value: facts.revenue, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.ordersDataAsOf, source: "restaurant_orders", currency: context.currency }) },
      { label: "الربح الإجمالي", timeContext: "تراكمي", href: "/workspace/restaurant", result: normalizedMetric({ id: "native.food.gross_profit", value: facts.grossProfit, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.ordersDataAsOf, source: "restaurant_orders", currency: context.currency }) },
    );
    current.push({ label: "حمل المطبخ", timeContext: "حاليًا", href: "/workspace/restaurant", detail: "NEW + PREPARING + READY هي حالة تشغيل حالية وليست Alert بحد ذاتها.", result: normalizedMetric({ id: "native.food.kitchen_workload", value: facts.kitchen.activeCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.kitchen.dataAsOf, source: "restaurant_kitchen_tickets" }) });
    supporting.push({ label: "تكلفة المكونات", timeContext: "تراكمي", href: "/workspace/restaurant", result: normalizedMetric({ id: "native.food.ingredient_cost", value: facts.ingredientCost, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.ordersDataAsOf, source: "restaurant_orders", currency: context.currency }) });
    if (facts.kitchen.averageTicketMinutes !== null) supporting.push({ label: "متوسط زمن التجهيز", timeContext: "تراكمي", href: "/workspace/restaurant", detail: "من opened_at إلى ready_at فقط؛ لا يستخدم join مع الطلبات لحساب الإيراد.", result: normalizedMetric({ id: "native.food.avg_ticket_minutes", value: facts.kitchen.averageTicketMinutes, period: cumulative, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.kitchen.dataAsOf, source: "restaurant_kitchen_tickets" }) });
    normalizedMetric({ id: "native.food.kitchen_attention_count", value: facts.kitchen.attentionCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.kitchen.dataAsOf, source: "restaurant_kitchen_tickets" });
    if (facts.kitchen.attentionCount > 0) attention.push({ severity: "attention", title: `${facts.kitchen.attentionCount} تذاكر مطبخ عالية/عاجلة`, description: "فقط HIGH وURGENT ضمن NEW/PREPARING/READY تحتاج إبرازًا؛ الحالات التشغيلية العادية لا تتحول إلى Alerts.", href: "/workspace/restaurant", samples: facts.kitchen.attentionSample.map((ticket) => ticket.ticketNumber) });
  }

  if (context.enabledModules.includes("inventory")) {
    normalizedMetric({ id: "native.food.ingredient_stock_out_count", value: facts.ingredients.stockOutCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.ingredients.dataAsOf, source: "restaurant_recipe_ingredients+business_products" });
    normalizedMetric({ id: "native.food.ingredient_low_stock_count", value: facts.ingredients.lowStockCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, dataAsOf: facts.ingredients.dataAsOf, source: "restaurant_recipe_ingredients+business_products" });
    if (facts.ingredients.stockOutCount > 0) critical.push({ severity: "critical", title: `${facts.ingredients.stockOutCount} مكونات وصفات نفد مخزونها`, description: "يقتصر الفحص على المنتجات المستخدمة فعليًا في وصفات نشطة؛ stock_quantity = 0 يمكن أن يمنع تشغيل الوجبات.", href: "/workspace/inventory", samples: sampleNames(facts.ingredients.stockOutSample) });
    if (facts.ingredients.lowStockCount > 0) attention.push({ severity: "attention", title: `${facts.ingredients.lowStockCount} مكونات عند حد المخزون المنخفض`, description: "يعتمد التصنيف على low_stock_threshold الخاصة بكل مكوّن.", href: "/workspace/inventory", samples: sampleNames(facts.ingredients.lowStockSample) });
  }

  taskAttention(context, data, calculatedAt, current, attention);
  return Object.freeze({ ...model, isFirstUse: facts.orderCount === 0 && facts.recipeCount === 0, primary: Object.freeze(primary), current: Object.freeze(current), supporting: Object.freeze(supporting), critical: Object.freeze(critical), attention: Object.freeze(attention), notices: Object.freeze(notices) });
}

function buildHospitality(context: NativeOverviewContext, data: NativeDashboardData, facts: NativeHospitalityFacts, calculatedAt: string) {
  const model = emptyModel(context, data);
  const primary: NativeMetricView[] = [];
  const current: NativeMetricView[] = [];
  const supporting: NativeMetricView[] = [];
  const critical: NativeAttentionItem[] = [];
  const attention: NativeAttentionItem[] = [];
  const notices: NativeStatusNotice[] = [];
  const snapshot = snapshotPeriod(calculatedAt);

  if (context.enabledModules.includes("hotel")) {
    primary.push(
      { label: "إجمالي الغرف", timeContext: "حاليًا", href: "/workspace/hotel", result: normalizedMetric({ id: "native.hotel.total_rooms", value: facts.totalRooms, period: snapshot, calculatedAt, workspaceCurrency: context.currency, source: "hotel_rooms" }) },
      { label: "الغرف المشغولة", timeContext: "حاليًا", href: "/workspace/hotel", result: normalizedMetric({ id: "native.hotel.occupied_rooms", value: facts.occupiedRooms, period: snapshot, calculatedAt, workspaceCurrency: context.currency, source: "hotel_rooms" }) },
    );
    const occupancy = calculateMetricRatio(facts.occupiedRooms, facts.totalRooms);
    primary.push({
      label: "نسبة الإشغال",
      timeContext: "حاليًا",
      href: "/workspace/hotel",
      detail: "sum(occupied_rooms) / sum(total_rooms) عبر كل المنشآت النشطة؛ ليست average لنسب Properties.",
      result: normalizedMetric({
        id: "native.hotel.occupancy",
        value: occupancy.value === null ? null : occupancy.value * 100,
        period: snapshot,
        calculatedAt,
        workspaceCurrency: context.currency,
        source: "hotel_rooms",
        availability: occupancy.value === null ? { state: "missing", reason: occupancy.reason ?? "occupancy_unavailable" } : undefined,
      }),
    });

    if (facts.invalidTimezoneCount > 0) {
      notices.push({ tone: "warning", title: "تعذر توحيد إيراد الغرف اليوم", description: "هناك منشأة واحدة على الأقل تحمل timezone غير صالح؛ لا تعرض مَدار رقم اليوم قبل تصحيح سياق الزمن.", href: "/workspace/hotel" });
    } else if (facts.propertyTimezones.length > 1) {
      notices.push({ tone: "info", title: "إيراد اليوم موزع على مناطق زمنية متعددة", description: `المنشآت تستخدم: ${facts.propertyTimezones.join("، ")}. لا تفرض النظرة العامة يومًا عالميًا واحدًا على هذه البيانات.`, href: "/workspace/hotel" });
    } else if (facts.propertyTimezones.length === 1) {
      const revenue = collapseMoney(facts.roomRevenueByCurrency, context.currency);
      if (revenue.safe) {
        primary.push({ label: "إيراد الغرف", timeContext: "اليوم", href: "/workspace/hotel", detail: `اليوم المحلي للمنشأة: ${facts.propertyTimezones[0]}`, result: normalizedMetric({ id: "native.hotel.room_revenue_today", value: revenue.value, period: localTodayPeriod(calculatedAt, facts.propertyTimezones[0]), calculatedAt, workspaceCurrency: context.currency, dataAsOf: revenue.dataAsOf, source: "hotel_folio_charges+hotel_folios", currency: revenue.currency }) });
      } else {
        notices.push({ tone: "warning", title: "إيراد الغرف اليوم متعدد العملات", description: `العملات الموجودة: ${revenue.currencies.join("، ")}. لا يتم جمعها أو تحويلها ضمن Phase 7.`, href: "/workspace/hotel" });
      }
    }

    current.push(
      { label: "الإقامات داخل الفندق", timeContext: "حاليًا", href: "/workspace/hotel", result: normalizedMetric({ id: "native.hotel.in_house_stays", value: facts.inHouseStays, period: snapshot, calculatedAt, workspaceCurrency: context.currency, source: "hotel_stays" }) },
      { label: "مهام التنظيف المفتوحة", timeContext: "حاليًا", href: "/workspace/hotel", result: normalizedMetric({ id: "native.hotel.housekeeping_active", value: facts.housekeeping.activeCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, source: "hotel_housekeeping_tasks" }) },
      { label: "طلبات الصيانة المفتوحة", timeContext: "حاليًا", href: "/workspace/hotel", result: normalizedMetric({ id: "native.hotel.maintenance_active", value: facts.maintenance.activeCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, source: "hotel_maintenance_requests" }) },
    );
    normalizedMetric({ id: "native.hotel.housekeeping_blocked", value: facts.housekeeping.blockedCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, source: "hotel_housekeeping_tasks" });
    normalizedMetric({ id: "native.hotel.maintenance_emergency", value: facts.maintenance.emergencyCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, source: "hotel_maintenance_requests" });
    normalizedMetric({ id: "native.hotel.maintenance_high", value: facts.maintenance.highCount, period: snapshot, calculatedAt, workspaceCurrency: context.currency, source: "hotel_maintenance_requests" });
    if (facts.maintenance.emergencyCount > 0) critical.push({ severity: "critical", title: `${facts.maintenance.emergencyCount} طلبات صيانة طارئة`, description: "EMERGENCY ضمن طلب صيانة مفتوح حقيقة تشغيلية حرجة، وليست استنتاجًا من رقم أو Score.", href: "/workspace/hotel", samples: facts.maintenance.emergencySample.map((item) => item.title) });
    if (facts.maintenance.highCount > 0) attention.push({ severity: "attention", title: `${facts.maintenance.highCount} طلبات صيانة عالية الأولوية`, description: "HIGH ضمن طلب صيانة مفتوح يحتاج متابعة، لكنه لا يُرفع تلقائيًا إلى Critical.", href: "/workspace/hotel", samples: facts.maintenance.highSample.map((item) => item.title) });
    if (facts.housekeeping.blockedCount > 0) attention.push({ severity: "attention", title: `${facts.housekeeping.blockedCount} مهام تنظيف محجوبة`, description: "BLOCKED هي الحالة التي تحتاج تدخلًا؛ PENDING/ASSIGNED/IN_PROGRESS/INSPECTION تبقى Current Operating State.", href: "/workspace/hotel", samples: facts.housekeeping.blockedSample.map((item) => `غرفة ${item.roomNumber}`) });
  }

  taskAttention(context, data, calculatedAt, current, attention);
  return Object.freeze({ ...model, isFirstUse: facts.propertyCount === 0 && facts.totalRooms === 0, primary: Object.freeze(primary), current: Object.freeze(current), supporting: Object.freeze(supporting), critical: Object.freeze(critical), attention: Object.freeze(attention), notices: Object.freeze(notices) });
}

export function buildNativeOverviewModel(context: NativeOverviewContext, data: NativeDashboardData, calculatedAt: string): NativeOverviewModel {
  const base = emptyModel(context, data);
  if (base.setupRequired) return Object.freeze(base);
  if (data.facts.failed || !data.facts.data || !data.organizationCreatedAt) return Object.freeze({ ...base, isPartial: true, failedSources: Object.freeze([...new Set([...base.failedSources, "vertical_facts"])]) });
  if (data.facts.data.kind !== context.extension) return Object.freeze({ ...base, isPartial: true, failedSources: Object.freeze([...new Set([...base.failedSources, "vertical_mismatch"])]) });
  if (context.extension === "commerce") return buildCommerce(context, data, data.facts.data as NativeCommerceFacts, calculatedAt);
  if (context.extension === "food_service") return buildFood(context, data, data.facts.data as NativeFoodFacts, calculatedAt);
  return buildHospitality(context, data, data.facts.data as NativeHospitalityFacts, calculatedAt);
}
