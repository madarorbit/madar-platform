import "server-only";

import { cache } from "react";
import { supabaseFetch } from "@/src/lib/supabase/server";
import type {
  NativeCommerceFacts,
  NativeCommerceSalesBucket,
  NativeDashboardData,
  NativeFoodFacts,
  NativeHospitalityFacts,
  NativeHousekeepingItem,
  NativeKitchenTicket,
  NativeMaintenanceItem,
  NativeMoneyBucket,
  NativeSection,
  NativeStockItem,
  NativeTaskFacts,
  NativeTaskItem,
  NativeVertical,
  NativeVerticalFacts,
} from "./domain";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`NATIVE_INVALID_OBJECT:${path}`);
  return value as UnknownRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`NATIVE_INVALID_ARRAY:${path}`);
  return value;
}

function text(value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`NATIVE_INVALID_TEXT:${path}`);
  return value;
}

function nullableText(value: unknown, path: string) {
  if (value === null) return null;
  return text(value, path);
}

function finiteNumber(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`NATIVE_INVALID_NUMBER:${path}`);
  return value;
}

function nullableNumber(value: unknown, path: string) {
  if (value === null) return null;
  return finiteNumber(value, path);
}

function integer(value: unknown, path: string) {
  const result = finiteNumber(value, path);
  if (!Number.isInteger(result)) throw new Error(`NATIVE_INVALID_INTEGER:${path}`);
  return result;
}

function moneyBucket(value: unknown, path: string): NativeMoneyBucket {
  const row = record(value, path);
  return Object.freeze({
    currency: text(row.currency, `${path}.currency`).toUpperCase(),
    amount: finiteNumber(row.amount, `${path}.amount`),
    dataAsOf: nullableText(row.data_as_of, `${path}.data_as_of`),
  });
}

function salesBucket(value: unknown, path: string): NativeCommerceSalesBucket {
  const row = record(value, path);
  return Object.freeze({
    currency: text(row.currency, `${path}.currency`).toUpperCase(),
    amount: finiteNumber(row.revenue, `${path}.revenue`),
    completedSalesCount: integer(row.completed_sales_count, `${path}.completed_sales_count`),
    dataAsOf: nullableText(row.data_as_of, `${path}.data_as_of`),
  });
}

function stockItem(value: unknown, path: string): NativeStockItem {
  const row = record(value, path);
  return Object.freeze({
    id: text(row.id, `${path}.id`),
    name: text(row.name, `${path}.name`),
    stockQuantity: finiteNumber(row.stock_quantity, `${path}.stock_quantity`),
    lowStockThreshold: finiteNumber(row.low_stock_threshold, `${path}.low_stock_threshold`),
  });
}

function kitchenTicket(value: unknown, path: string): NativeKitchenTicket {
  const row = record(value, path);
  return Object.freeze({
    id: text(row.id, `${path}.id`),
    ticketNumber: text(row.ticket_number, `${path}.ticket_number`),
    status: text(row.status, `${path}.status`),
    priority: text(row.priority, `${path}.priority`),
    openedAt: text(row.opened_at, `${path}.opened_at`),
  });
}

function housekeepingItem(value: unknown, path: string): NativeHousekeepingItem {
  const row = record(value, path);
  return Object.freeze({
    id: text(row.id, `${path}.id`),
    roomNumber: text(row.room_number, `${path}.room_number`),
    taskType: text(row.task_type, `${path}.task_type`),
    status: text(row.status, `${path}.status`),
    serviceDate: text(row.service_date, `${path}.service_date`),
  });
}

function maintenanceItem(value: unknown, path: string): NativeMaintenanceItem {
  const row = record(value, path);
  return Object.freeze({
    id: text(row.id, `${path}.id`),
    title: text(row.title, `${path}.title`),
    priority: text(row.priority, `${path}.priority`),
    status: text(row.status, `${path}.status`),
    createdAt: text(row.created_at, `${path}.created_at`),
  });
}

function taskItem(value: unknown, path: string): NativeTaskItem {
  const row = record(value, path);
  return Object.freeze({
    id: text(row.id, `${path}.id`),
    title: text(row.title, `${path}.title`),
    priority: text(row.priority, `${path}.priority`),
    dueAt: text(row.due_at, `${path}.due_at`),
  });
}

function normalizeCommerce(input: unknown): NativeCommerceFacts {
  const facts = record(input, "facts.commerce");
  const inventory = record(facts.inventory, "facts.commerce.inventory");
  return Object.freeze({
    kind: "commerce" as const,
    salesByCurrency: Object.freeze(array(facts.sales_by_currency, "facts.commerce.sales_by_currency").map((item, index) => salesBucket(item, `facts.commerce.sales_by_currency.${index}`))),
    cogsByCurrency: Object.freeze(array(facts.cogs_by_currency, "facts.commerce.cogs_by_currency").map((item, index) => moneyBucket(item, `facts.commerce.cogs_by_currency.${index}`))),
    returnsByCurrency: Object.freeze(array(facts.returns_by_currency, "facts.commerce.returns_by_currency").map((item, index) => moneyBucket(item, `facts.commerce.returns_by_currency.${index}`))),
    expensesByCurrency: Object.freeze(array(facts.expenses_by_currency, "facts.commerce.expenses_by_currency").map((item, index) => moneyBucket(item, `facts.commerce.expenses_by_currency.${index}`))),
    inventory: Object.freeze({
      activeProductCount: integer(inventory.active_product_count, "facts.commerce.inventory.active_product_count"),
      inventoryValue: finiteNumber(inventory.inventory_value, "facts.commerce.inventory.inventory_value"),
      stockOutCount: integer(inventory.stock_out_count, "facts.commerce.inventory.stock_out_count"),
      lowStockCount: integer(inventory.low_stock_count, "facts.commerce.inventory.low_stock_count"),
      dataAsOf: nullableText(inventory.data_as_of, "facts.commerce.inventory.data_as_of"),
      stockOutSample: Object.freeze(array(inventory.stock_out_sample, "facts.commerce.inventory.stock_out_sample").map((item, index) => stockItem(item, `facts.commerce.inventory.stock_out_sample.${index}`))),
      lowStockSample: Object.freeze(array(inventory.low_stock_sample, "facts.commerce.inventory.low_stock_sample").map((item, index) => stockItem(item, `facts.commerce.inventory.low_stock_sample.${index}`))),
    }),
  });
}

function normalizeFood(input: unknown): NativeFoodFacts {
  const facts = record(input, "facts.food_service");
  const kitchen = record(facts.kitchen, "facts.food_service.kitchen");
  const ingredients = record(facts.ingredients, "facts.food_service.ingredients");
  return Object.freeze({
    kind: "food_service" as const,
    orderCount: integer(facts.order_count, "facts.food_service.order_count"),
    recipeCount: integer(facts.recipe_count, "facts.food_service.recipe_count"),
    completedOrders: integer(facts.completed_orders, "facts.food_service.completed_orders"),
    revenue: finiteNumber(facts.revenue, "facts.food_service.revenue"),
    ingredientCost: finiteNumber(facts.ingredient_cost, "facts.food_service.ingredient_cost"),
    grossProfit: finiteNumber(facts.gross_profit, "facts.food_service.gross_profit"),
    ordersDataAsOf: nullableText(facts.orders_data_as_of, "facts.food_service.orders_data_as_of"),
    kitchen: Object.freeze({
      activeCount: integer(kitchen.active_count, "facts.food_service.kitchen.active_count"),
      attentionCount: integer(kitchen.attention_count, "facts.food_service.kitchen.attention_count"),
      averageTicketMinutes: nullableNumber(kitchen.avg_ticket_minutes, "facts.food_service.kitchen.avg_ticket_minutes"),
      dataAsOf: nullableText(kitchen.data_as_of, "facts.food_service.kitchen.data_as_of"),
      attentionSample: Object.freeze(array(kitchen.attention_sample, "facts.food_service.kitchen.attention_sample").map((item, index) => kitchenTicket(item, `facts.food_service.kitchen.attention_sample.${index}`))),
    }),
    ingredients: Object.freeze({
      ingredientProductCount: integer(ingredients.ingredient_product_count, "facts.food_service.ingredients.ingredient_product_count"),
      stockOutCount: integer(ingredients.stock_out_count, "facts.food_service.ingredients.stock_out_count"),
      lowStockCount: integer(ingredients.low_stock_count, "facts.food_service.ingredients.low_stock_count"),
      dataAsOf: nullableText(ingredients.data_as_of, "facts.food_service.ingredients.data_as_of"),
      stockOutSample: Object.freeze(array(ingredients.stock_out_sample, "facts.food_service.ingredients.stock_out_sample").map((item, index) => stockItem(item, `facts.food_service.ingredients.stock_out_sample.${index}`))),
      lowStockSample: Object.freeze(array(ingredients.low_stock_sample, "facts.food_service.ingredients.low_stock_sample").map((item, index) => stockItem(item, `facts.food_service.ingredients.low_stock_sample.${index}`))),
    }),
  });
}

function normalizeHospitality(input: unknown): NativeHospitalityFacts {
  const facts = record(input, "facts.hospitality");
  const housekeeping = record(facts.housekeeping, "facts.hospitality.housekeeping");
  const maintenance = record(facts.maintenance, "facts.hospitality.maintenance");
  return Object.freeze({
    kind: "hospitality" as const,
    propertyCount: integer(facts.property_count, "facts.hospitality.property_count"),
    propertyTimezones: Object.freeze(array(facts.property_timezones, "facts.hospitality.property_timezones").map((item, index) => text(item, `facts.hospitality.property_timezones.${index}`))),
    invalidTimezoneCount: integer(facts.invalid_timezone_count, "facts.hospitality.invalid_timezone_count"),
    totalRooms: integer(facts.total_rooms, "facts.hospitality.total_rooms"),
    occupiedRooms: integer(facts.occupied_rooms, "facts.hospitality.occupied_rooms"),
    roomRevenueByCurrency: Object.freeze(array(facts.room_revenue_by_currency, "facts.hospitality.room_revenue_by_currency").map((item, index) => moneyBucket(item, `facts.hospitality.room_revenue_by_currency.${index}`))),
    inHouseStays: integer(facts.in_house_stays, "facts.hospitality.in_house_stays"),
    housekeeping: Object.freeze({
      activeCount: integer(housekeeping.active_count, "facts.hospitality.housekeeping.active_count"),
      blockedCount: integer(housekeeping.blocked_count, "facts.hospitality.housekeeping.blocked_count"),
      blockedSample: Object.freeze(array(housekeeping.blocked_sample, "facts.hospitality.housekeeping.blocked_sample").map((item, index) => housekeepingItem(item, `facts.hospitality.housekeeping.blocked_sample.${index}`))),
    }),
    maintenance: Object.freeze({
      activeCount: integer(maintenance.active_count, "facts.hospitality.maintenance.active_count"),
      emergencyCount: integer(maintenance.emergency_count, "facts.hospitality.maintenance.emergency_count"),
      highCount: integer(maintenance.high_count, "facts.hospitality.maintenance.high_count"),
      emergencySample: Object.freeze(array(maintenance.emergency_sample, "facts.hospitality.maintenance.emergency_sample").map((item, index) => maintenanceItem(item, `facts.hospitality.maintenance.emergency_sample.${index}`))),
      highSample: Object.freeze(array(maintenance.high_sample, "facts.hospitality.maintenance.high_sample").map((item, index) => maintenanceItem(item, `facts.hospitality.maintenance.high_sample.${index}`))),
    }),
  });
}

function normalizeVerticalFacts(input: unknown, expectedVertical: NativeVertical): { organizationCreatedAt: string; facts: NativeVerticalFacts } {
  const root = record(input, "native_dashboard_facts");
  const vertical = text(root.vertical, "native_dashboard_facts.vertical") as NativeVertical;
  if (vertical !== expectedVertical) throw new Error("NATIVE_DASHBOARD_VERTICAL_MISMATCH");
  const organizationCreatedAt = text(root.organization_created_at, "native_dashboard_facts.organization_created_at");
  const facts = expectedVertical === "commerce"
    ? normalizeCommerce(root.facts)
    : expectedVertical === "food_service"
      ? normalizeFood(root.facts)
      : normalizeHospitality(root.facts);
  return Object.freeze({ organizationCreatedAt, facts });
}

export function normalizeNativeTaskFacts(input: unknown): NativeTaskFacts {
  const facts = record(input, "native_dashboard_task_facts");
  return Object.freeze({
    overdueCount: integer(facts.overdue_count, "native_dashboard_task_facts.overdue_count"),
    highUrgentOverdueCount: integer(facts.high_urgent_overdue_count, "native_dashboard_task_facts.high_urgent_overdue_count"),
    dataAsOf: nullableText(facts.data_as_of, "native_dashboard_task_facts.data_as_of"),
    overdueSample: Object.freeze(array(facts.overdue_sample, "native_dashboard_task_facts.overdue_sample").map((item, index) => taskItem(item, `native_dashboard_task_facts.overdue_sample.${index}`))),
  });
}

async function section<T>(operation: Promise<T>): Promise<NativeSection<T>> {
  try {
    return Object.freeze({ data: await operation, failed: false });
  } catch {
    return Object.freeze({ data: null, failed: true });
  }
}

async function loadVertical(organizationId: string, vertical: NativeVertical) {
  const raw = await supabaseFetch("/rest/v1/rpc/native_dashboard_facts", {
    method: "POST",
    body: JSON.stringify({ target_organization: organizationId, target_vertical: vertical }),
  });
  return normalizeVerticalFacts(raw, vertical);
}

async function loadTasks(organizationId: string) {
  const raw = await supabaseFetch("/rest/v1/rpc/native_dashboard_task_facts", {
    method: "POST",
    body: JSON.stringify({ target_organization: organizationId }),
  });
  return normalizeNativeTaskFacts(raw);
}

export const getNativeDashboardData = cache(async (
  organizationId: string,
  vertical: NativeVertical,
  enabledModules: readonly string[],
): Promise<NativeDashboardData> => {
  const [verticalResult, tasks] = await Promise.all([
    section(loadVertical(organizationId, vertical)),
    enabledModules.includes("tasks")
      ? section(loadTasks(organizationId))
      : Promise.resolve(Object.freeze({ data: null, failed: false }) as NativeSection<NativeTaskFacts>),
  ]);

  return Object.freeze({
    organizationCreatedAt: verticalResult.data?.organizationCreatedAt ?? null,
    facts: Object.freeze({ data: verticalResult.data?.facts ?? null, failed: verticalResult.failed }),
    tasks,
  });
});
