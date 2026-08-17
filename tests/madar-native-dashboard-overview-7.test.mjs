import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');
const domain = await import(new URL('../src/lib/native/dashboard/domain.ts', import.meta.url));

const calculatedAt = '2026-08-17T09:30:00.000Z';
const organizationCreatedAt = '2026-01-01T00:00:00.000Z';

function context(extension, enabledModules, overrides = {}) {
  return {
    currency: 'SAR',
    setupStatus: 'ready',
    extension,
    specializationName: extension,
    enabledModules,
    ...overrides,
  };
}

const noTasks = { data: null, failed: false };

function commerceFacts(overrides = {}) {
  return {
    kind: 'commerce',
    salesByCurrency: [{ currency: 'SAR', amount: 1200, completedSalesCount: 6, dataAsOf: '2026-08-17T09:00:00.000Z' }],
    cogsByCurrency: [{ currency: 'SAR', amount: 500, dataAsOf: '2026-08-17T09:00:00.000Z' }],
    returnsByCurrency: [{ currency: 'SAR', amount: 50, dataAsOf: '2026-08-17T09:00:00.000Z' }],
    expensesByCurrency: [{ currency: 'SAR', amount: 100, dataAsOf: '2026-08-17T08:00:00.000Z' }],
    inventory: {
      activeProductCount: 10,
      inventoryValue: 3000,
      stockOutCount: 0,
      lowStockCount: 0,
      dataAsOf: '2026-08-17T08:30:00.000Z',
      stockOutSample: [],
      lowStockSample: [],
    },
    ...overrides,
  };
}

function foodFacts(overrides = {}) {
  return {
    kind: 'food_service',
    orderCount: 20,
    recipeCount: 8,
    completedOrders: 12,
    revenue: 2400,
    ingredientCost: 900,
    grossProfit: 1500,
    ordersDataAsOf: '2026-08-17T09:00:00.000Z',
    kitchen: {
      activeCount: 4,
      attentionCount: 0,
      averageTicketMinutes: 14.5,
      dataAsOf: '2026-08-17T09:10:00.000Z',
      attentionSample: [],
    },
    ingredients: {
      ingredientProductCount: 14,
      stockOutCount: 0,
      lowStockCount: 0,
      dataAsOf: '2026-08-17T08:45:00.000Z',
      stockOutSample: [],
      lowStockSample: [],
    },
    ...overrides,
  };
}

function hotelFacts(overrides = {}) {
  return {
    kind: 'hospitality',
    propertyCount: 2,
    propertyTimezones: ['Asia/Aden'],
    invalidTimezoneCount: 0,
    totalRooms: 20,
    occupiedRooms: 10,
    roomRevenueByCurrency: [{ currency: 'SAR', amount: 1800, dataAsOf: '2026-08-17T08:00:00.000Z' }],
    inHouseStays: 10,
    housekeeping: { activeCount: 5, blockedCount: 0, blockedSample: [] },
    maintenance: { activeCount: 2, emergencyCount: 0, highCount: 0, emergencySample: [], highSample: [] },
    ...overrides,
  };
}

function data(facts, tasks = noTasks) {
  return { organizationCreatedAt, facts: { data: facts, failed: false }, tasks };
}

test('setup status and core enabledModule are real admission gates', () => {
  assert.equal(domain.nativeSetupRequired(context('commerce', ['sales'], { setupStatus: 'in_progress' })), true);
  assert.equal(domain.nativeSetupRequired(context('commerce', ['inventory'])), true);
  assert.equal(domain.nativeSetupRequired(context('food_service', ['restaurant'])), false);
  assert.equal(domain.nativeSetupRequired(context('hospitality', ['hotel'])), false);
  const model = domain.buildNativeOverviewModel(context('commerce', ['inventory']), data(commerceFacts()), calculatedAt);
  assert.equal(model.setupRequired, true);
  assert.deepEqual(model.primary, []);
});

test('enabledModules admission removes inventory metrics and alerts when inventory is disabled', () => {
  const facts = commerceFacts({ inventory: { ...commerceFacts().inventory, stockOutCount: 2, lowStockCount: 3, stockOutSample: [{ id: 'p1', name: 'نفد', stockQuantity: 0, lowStockThreshold: 2 }], lowStockSample: [{ id: 'p2', name: 'منخفض', stockQuantity: 1, lowStockThreshold: 2 }] } });
  const model = domain.buildNativeOverviewModel(context('commerce', ['sales']), data(facts), calculatedAt);
  assert.equal(model.current.some((metric) => metric.result.metricId.includes('inventory')), false);
  assert.equal(model.critical.length, 0);
  assert.equal(model.attention.length, 0);
});

test('vertical fact failure is Partial and never synthesizes zero business metrics', () => {
  const model = domain.buildNativeOverviewModel(context('commerce', ['sales']), {
    organizationCreatedAt: null,
    facts: { data: null, failed: true },
    tasks: noTasks,
  }, calculatedAt);
  assert.equal(model.isPartial, true);
  assert.deepEqual(model.primary, []);
  assert.ok(model.failedSources.includes('vertical_facts'));
});

test('Native metrics use complete Phase 4 NormalizedMetricResult contracts', () => {
  const model = domain.buildNativeOverviewModel(context('commerce', ['sales', 'inventory', 'expenses']), data(commerceFacts()), calculatedAt);
  const metrics = [...model.primary, ...model.current, ...model.supporting].map((item) => item.result);
  assert.ok(metrics.length >= 5);
  for (const metric of metrics) {
    assert.equal(typeof metric.metricId, 'string');
    assert.equal(metric.definitionVersion, '1');
    assert.ok(metric.availability?.state);
    assert.ok(metric.coverage?.state);
    assert.ok(metric.freshness?.state);
    assert.ok(metric.provenance?.category);
    assert.ok(metric.calculatedAt);
    assert.ok(metric.period?.fromInclusive);
    assert.ok(metric.period?.toExclusive);
  }
});

test('Commerce stock-out is Critical and low-stock uses the stored domain threshold as Attention', () => {
  const base = commerceFacts().inventory;
  const facts = commerceFacts({ inventory: {
    ...base,
    stockOutCount: 1,
    lowStockCount: 1,
    stockOutSample: [{ id: 'p1', name: 'الصنف المنتهي', stockQuantity: 0, lowStockThreshold: 3 }],
    lowStockSample: [{ id: 'p2', name: 'الصنف المنخفض', stockQuantity: 2, lowStockThreshold: 3 }],
  } });
  const model = domain.buildNativeOverviewModel(context('commerce', ['sales', 'inventory']), data(facts), calculatedAt);
  assert.equal(model.critical.length, 1);
  assert.match(model.critical[0].title, /نفد/);
  assert.equal(model.attention.length, 1);
  assert.match(model.attention[0].description, /low_stock_threshold/);
});

test('Food normal kitchen workload stays Current State; only HIGH/URGENT active work becomes Attention', () => {
  const normal = domain.buildNativeOverviewModel(context('food_service', ['restaurant']), data(foodFacts()), calculatedAt);
  assert.equal(normal.current.some((metric) => metric.result.metricId === 'native.food.kitchen_workload'), true);
  assert.equal(normal.attention.length, 0);

  const urgentFacts = foodFacts({ kitchen: {
    ...foodFacts().kitchen,
    attentionCount: 1,
    attentionSample: [{ id: 'k1', ticketNumber: 'K-1', status: 'PREPARING', priority: 'URGENT', openedAt: '2026-08-17T09:00:00.000Z' }],
  } });
  const urgent = domain.buildNativeOverviewModel(context('food_service', ['restaurant']), data(urgentFacts), calculatedAt);
  assert.equal(urgent.attention.length, 1);
  assert.match(urgent.attention[0].title, /عالية\/عاجلة/);
});

test('Food ingredient stock-out is Critical only when inventory module is admitted', () => {
  const facts = foodFacts({ ingredients: {
    ...foodFacts().ingredients,
    stockOutCount: 1,
    stockOutSample: [{ id: 'p1', name: 'مكوّن نافد', stockQuantity: 0, lowStockThreshold: 1 }],
  } });
  const withoutInventory = domain.buildNativeOverviewModel(context('food_service', ['restaurant']), data(facts), calculatedAt);
  assert.equal(withoutInventory.critical.length, 0);
  const withInventory = domain.buildNativeOverviewModel(context('food_service', ['restaurant', 'inventory']), data(facts), calculatedAt);
  assert.equal(withInventory.critical.length, 1);
});

test('Hospitality occupancy is organization-weighted from room totals, never average of property percentages', () => {
  const model = domain.buildNativeOverviewModel(context('hospitality', ['hotel']), data(hotelFacts({ totalRooms: 25, occupiedRooms: 10 })), calculatedAt);
  const occupancy = model.primary.find((metric) => metric.result.metricId === 'native.hotel.occupancy');
  assert.equal(occupancy?.result.value, 40);
  assert.match(occupancy?.detail || '', /sum\(occupied_rooms\).*sum\(total_rooms\)/);
});

test('zero hotel room denominator stays Missing rather than becoming zero occupancy', () => {
  const model = domain.buildNativeOverviewModel(context('hospitality', ['hotel']), data(hotelFacts({ propertyCount: 1, totalRooms: 0, occupiedRooms: 0 })), calculatedAt);
  const occupancy = model.primary.find((metric) => metric.result.metricId === 'native.hotel.occupancy');
  assert.equal(occupancy?.result.value, null);
  assert.equal(occupancy?.result.availability.state, 'missing');
});

test('multi-currency hotel room revenue is never summed or converted implicitly', () => {
  const facts = hotelFacts({ roomRevenueByCurrency: [
    { currency: 'SAR', amount: 1000, dataAsOf: '2026-08-17T08:00:00.000Z' },
    { currency: 'USD', amount: 200, dataAsOf: '2026-08-17T08:10:00.000Z' },
  ] });
  const model = domain.buildNativeOverviewModel(context('hospitality', ['hotel']), data(facts), calculatedAt);
  assert.equal(model.primary.some((metric) => metric.result.metricId === 'native.hotel.room_revenue_today'), false);
  assert.ok(model.notices.some((notice) => /متعدد العملات/.test(notice.title)));
});

test('single-currency hotel revenue keeps its actual currency rather than workspace currency coercion', () => {
  const facts = hotelFacts({ roomRevenueByCurrency: [{ currency: 'USD', amount: 200, dataAsOf: '2026-08-17T08:10:00.000Z' }] });
  const model = domain.buildNativeOverviewModel(context('hospitality', ['hotel']), data(facts), calculatedAt);
  const revenue = model.primary.find((metric) => metric.result.metricId === 'native.hotel.room_revenue_today');
  assert.deepEqual(revenue?.result.unit, { kind: 'money', currency: 'USD' });
  assert.equal(revenue?.result.value, 200);
});

test('multiple hotel property timezones prevent a fake global today revenue metric', () => {
  const model = domain.buildNativeOverviewModel(context('hospitality', ['hotel']), data(hotelFacts({ propertyTimezones: ['Asia/Aden', 'Europe/London'] })), calculatedAt);
  assert.equal(model.primary.some((metric) => metric.result.metricId === 'native.hotel.room_revenue_today'), false);
  assert.ok(model.notices.some((notice) => /مناطق زمنية متعددة/.test(notice.title)));
});

test('overdue tasks are Attention and high/urgent overdue tasks elevate wording without becoming Critical', () => {
  const tasks = { data: { overdueCount: 3, highUrgentOverdueCount: 2, dataAsOf: '2026-08-17T09:00:00.000Z', overdueSample: [{ id: 't1', title: 'مهمة عاجلة', priority: 'urgent', dueAt: '2026-08-16T09:00:00.000Z' }] }, failed: false };
  const model = domain.buildNativeOverviewModel(context('commerce', ['sales', 'tasks']), data(commerceFacts(), tasks), calculatedAt);
  assert.ok(model.current.some((metric) => metric.result.metricId === 'native.tasks.overdue'));
  assert.ok(model.attention.some((item) => /عالية\/عاجلة/.test(item.title)));
  assert.equal(model.critical.length, 0);
});

test('EMERGENCY maintenance is Critical, HIGH maintenance and BLOCKED housekeeping are Attention', () => {
  const facts = hotelFacts({
    housekeeping: { activeCount: 2, blockedCount: 1, blockedSample: [{ id: 'h1', roomNumber: '101', taskType: 'TURNOVER', status: 'BLOCKED', serviceDate: '2026-08-17' }] },
    maintenance: {
      activeCount: 2,
      emergencyCount: 1,
      highCount: 1,
      emergencySample: [{ id: 'm1', title: 'تسرب حرج', priority: 'EMERGENCY', status: 'OPEN', createdAt: '2026-08-17T08:00:00.000Z' }],
      highSample: [{ id: 'm2', title: 'عطل مرتفع', priority: 'HIGH', status: 'OPEN', createdAt: '2026-08-17T08:10:00.000Z' }],
    },
  });
  const model = domain.buildNativeOverviewModel(context('hospitality', ['hotel']), data(facts), calculatedAt);
  assert.equal(model.critical.length, 1);
  assert.ok(model.attention.some((item) => /عالية الأولوية/.test(item.title)));
  assert.ok(model.attention.some((item) => /تنظيف محجوبة/.test(item.title)));
});

test('Native read-only SQL fixes restaurant semantics without order-ticket join duplication', async () => {
  const migration = await read('supabase/migrations/20260816235000_native_dashboard_facts.sql');
  assert.match(migration, /o\.status in \('SERVED', 'COMPLETED'\)/i);
  assert.doesNotMatch(migration, /completed_orders[\s\S]{0,500}join public\.restaurant_kitchen_tickets/i);
  assert.match(migration, /kitchen_summary[\s\S]*restaurant_kitchen_tickets/i);
  assert.doesNotMatch(migration, /restaurant_profit_report/i);
  assert.doesNotMatch(migration, /IN_KITCHEN[^\n]*completed_orders|READY[^\n]*completed_orders/i);
});

test('Hotel SQL aggregates all active properties, groups room revenue by currency, and never uses hotel_daily_report[0]', async () => {
  const migration = await read('supabase/migrations/20260816235000_native_dashboard_facts.sql');
  assert.match(migration, /active_properties[\s\S]*room_summary/i);
  assert.match(migration, /count\(r\.id\).*total_rooms/i);
  assert.match(migration, /group by f\.currency/i);
  assert.match(migration, /at time zone p\.timezone/i);
  assert.doesNotMatch(migration, /hotel_daily_report/i);
  assert.doesNotMatch(migration, /\[0\]/);
});

test('Native facts RPCs remain read-only SECURITY INVOKER with anon/public execute closed', async () => {
  const migration = await read('supabase/migrations/20260816235000_native_dashboard_facts.sql');
  assert.match(migration, /security invoker/gi);
  assert.match(migration, /revoke all on function public\.native_dashboard_facts\(uuid, text\) from public/i);
  assert.match(migration, /revoke execute on function public\.native_dashboard_facts\(uuid, text\) from anon/i);
  assert.match(migration, /grant execute on function public\.native_dashboard_facts\(uuid, text\) to authenticated, service_role/i);
});

test('Native Overview uses shared dashboard contracts, excludes Recent Activity feed, sectorMetrics and direct Recharts', async () => {
  const [page, component, server, domainSource] = await Promise.all([
    read('app/workspace/page.tsx'),
    read('components/native/NativeDecisionOverview.tsx'),
    read('src/lib/native/dashboard/server.ts'),
    read('src/lib/native/dashboard/domain.ts'),
  ]);
  assert.match(page, /NativeDecisionOverview/);
  assert.match(page, /ConnectedDecisionOverview/);
  for (const contract of ['DashboardMetricCard','DashboardCriticalException','DashboardAlertBlock','DashboardDataState','DashboardEmptyState','DataTrustIndicator']) assert.ok(component.includes(contract), contract);
  assert.doesNotMatch(`${page}\n${component}\n${server}\n${domainSource}`, /sectorMetrics\s*\(/);
  assert.doesNotMatch(`${component}\n${server}`, /sector_operation_events|آخر النشاط|Recent Activity/i);
  assert.doesNotMatch(component, /from ["']recharts["']/);
  assert.doesNotMatch(component, /DateRangeControl|DashboardFilterBar/);
  assert.doesNotMatch(`${component}\n${server}\n${domainSource}`, /retail\/workspace|AdminDashboard|FounderCommand|\/admin\/founder/i);
});
