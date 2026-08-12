import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const tsconfig = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
const imported = async (path) => {
  const importedModule = await tsImport(`../${path}`, {
    parentURL: import.meta.url,
    tsconfig,
  });
  return importedModule.default || importedModule["module.exports"] || importedModule;
};

test("Retail money and inventory domain logic remains decimal-safe", async () => {
  const { allocateDiscount, lineTotalMinor, moneyToMinor, nextStock, paymentStatus } =
    await imported("src/lib/retail/domain/financial.ts");
  assert.equal(moneyToMinor("123.45"), 12_345);
  assert.throws(() => moneyToMinor("1.234"), /INVALID_MONEY/);
  const lines = [lineTotalMinor(3, 1_250), lineTotalMinor(2, 2_400), 995];
  assert.equal(allocateDiscount(lines, 777).reduce((sum, value) => sum + value, 0), 777);
  assert.equal(paymentStatus(10_000, 4_000), "partial");
  assert.equal(nextStock(10, -3), 7);
  assert.throws(() => nextStock(2, -3), /INSUFFICIENT_STOCK/);
});

test("ORBY Retail refuses mutations and cites deterministic Retail evidence", async () => {
  const { buildGroundedAnswer } = await imported(
    "src/lib/retail/server/orby/grounding.ts",
  );
  const snapshot = {
    workspace_id: "w",
    currency: "YER",
    timezone: "Asia/Aden",
    as_of: "2026-08-11T00:00:00Z",
    period: { from: "2026-08-11", to: "2026-08-11", days: 1 },
    metrics: {
      revenue: 10_000,
      gross_sales: 10_000,
      returns: 0,
      estimated_cost_of_goods: 6_000,
      estimated_gross_profit: 4_000,
      expenses: 500,
      estimated_net_operating_result: 3_500,
      orders: 2,
      average_order_value: 5_000,
      cash_position: 7_000,
      cash_in: 10_000,
      cash_out: 3_000,
      receivables: 2_500,
      payables: 8_000,
      inventory_value: 50_000,
    },
    comparison: {
      previous_from: "2026-08-10",
      previous_to: "2026-08-10",
      previous_revenue: 7_000,
      revenue_change: 3_000,
      revenue_change_percent: 42.9,
    },
    top_products: [],
    low_stock: [],
    slow_moving: [],
    daily_sales: [],
    recent_activity: [],
    definitions: {},
  };
  const refused = buildGroundedAnswer("أنشئ فاتورة بيع", snapshot, [], []);
  assert.equal(refused.intent, "mutation_refusal");
  assert.deepEqual(refused.evidence, []);
  assert.equal(buildGroundedAnswer("create an invoice", snapshot, [], []).intent, "mutation_refusal");
  const debt = buildGroundedAnswer(
    "من أكثر عميل عليه دين؟",
    snapshot,
    [{ name: "سارة", balance_due: 2_500 }],
    [],
  );
  assert.match(debt.fallbackAnswer, /سارة/);
  assert.ok(debt.evidence.every((item) => item.source.startsWith("retail_")));
});

test("Retail integration uses the Platform session and the primary server-only database", async () => {
  const [context, database, sync, orby, proxy] = await Promise.all([
    read("src/lib/retail/server/auth/context.ts"),
    read("src/lib/retail/supabase/server.ts"),
    read("src/lib/retail/sync/http.ts"),
    read("app/api/retail/orby/route.ts"),
    read("proxy.ts"),
  ]);
  assert.match(context, /currentUser/);
  assert.match(context, /workspace_subscriptions/);
  assert.match(context, /service_code=eq\.MADAR_RETAIL/);
  assert.match(context, /platform_organization_id/);
  assert.match(context, /authorizeOrganizationAction/);
  assert.doesNotMatch(context, /retail\/supabase\/request/);
  assert.match(database, /supabaseServiceConfig/);
  assert.doesNotMatch(database, /RETAIL_SUPABASE_(?:URL|SERVICE_ROLE_KEY)/);
  assert.doesNotMatch(database, /NEXT_PUBLIC_RETAIL.*SERVICE/i);
  assert.match(sync, /authorizeRetailRequest/);
  assert.match(orby, /createServerOrbyFoundation/);
  assert.match(orby, /can_use_orby/);
  assert.match(orby, /read-only|للقراءة|قراءة/iu);
  assert.match(proxy, /\/retail\/workspace/);
  const activation = await read("supabase/migrations/20260812180836_retail_account_service_activation_unified.sql");
  assert.match(activation, /activate_retail_service/);
  assert.match(activation, /caller_role <> 'service_role'/);
});

test("Retail PostgreSQL bridge is service-only, allowlisted, and preserves atomic RPCs", async () => {
  const [bridge, hardening] = await Promise.all([
    read("supabase/migrations/20260812180827_retail_platform_integration_unified.sql"),
    read("supabase/migrations/20260812180844_retail_platform_bridge_hardening.sql"),
  ]);
  assert.match(bridge, /caller_role <> 'service_role'/);
  assert.match(bridge, /PLATFORM_OPERATION_NOT_ALLOWED/);
  assert.match(bridge, /pg_advisory_xact_lock/);
  assert.match(bridge, /public\.retail_create_sale/);
  assert.match(bridge, /public\.retail_create_purchase/);
  assert.match(bridge, /public\.retail_analytics_snapshot/);
  assert.doesNotMatch(bridge, /execute\s+operation_name/i);
  assert.match(hardening, /revoke execute on function %s from authenticated/);
  assert.match(hardening, /procedure\.proname = any/);
  assert.doesNotMatch(hardening, /procedure\.proname <> 'retail_platform_execute'/);
});

test("Retail tables are namespaced and tenant RLS does not alter MADAR privileges", async () => {
  const [foundation, security, rlsTest] = await Promise.all([
    read("supabase/migrations/20260812180712_retail_foundation_unified.sql"),
    read("supabase/migrations/20260812180807_retail_security_unified.sql"),
    read("supabase/tests/001_retail_core_and_rls.sql"),
  ]);
  for (const table of [
    "retail_profiles",
    "retail_workspace_members",
    "retail_products",
    "retail_sales",
    "retail_inventory_movements",
    "retail_cash_transactions",
  ]) {
    assert.match(`${foundation}\n${security}\n${rlsTest}`, new RegExp(`public\\.${table}\\b`));
  }
  assert.match(security, /enable row level security/);
  assert.match(rlsTest, /RLS_TENANT_LEAK/);
  assert.doesNotMatch(security, /revoke all on all tables in schema public/);
});
