import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Connected navigation is connection-first and never exposes Native mutation pages", async () => {
  const navigation = await read("src/lib/v2/navigation.ts");
  assert.match(navigation, /connectedData/);
  assert.match(navigation, /href: "\/workspace\/data"/);
  assert.match(navigation, /connected \? \[connectedData\]/);
  assert.match(navigation, /const enabled = enabledKeys \? new Set/);
});

test("Connected dashboard uses live integration health, sync and UDM records", async () => {
  const [dashboard, server, data] = await Promise.all([
    read("app/workspace/page.tsx"),
    read("src/lib/services/experience.ts"),
    read("app/workspace/data/page.tsx"),
  ]);
  for (const contract of ["حالة الربط", "آخر مزامنة ناجحة", "البيانات الواصلة", "تنبيهات مفتوحة"])
    assert.ok(dashboard.includes(contract), contract);
  for (const table of ["integration_connections", "integration_health_snapshots", "integration_sync_runs", "integration_health_incidents", "integration_udm_records"])
    assert.ok(server.includes(table), table);
  assert.match(data, /duplicate_of=is\.null/);
  assert.doesNotMatch(`${dashboard}\n${data}`, /const (demo|mock)|demoRecords|mockRecords/i);
});

test("external source of truth cannot mutate Native business operations", async () => {
  const [actions, business] = await Promise.all([
    read("app/actions/business.ts"),
    read("src/lib/business.ts"),
  ]);
  assert.match(actions, /assertNativeOperations/);
  assert.match(actions, /CONNECTED_EXTERNAL/);
  assert.match(business, /requireNativeBusinessWorkspace/);
  assert.match(business, /redirect\("\/workspace\/data"\)/);
  assert.match(business, /module=unavailable/);
});

test("Native dashboard and navigation only expose enabled modules", async () => {
  const [dashboard, navigation] = await Promise.all([
    read("app/workspace/page.tsx"),
    read("src/lib/v2/navigation.ts"),
  ]);
  assert.match(dashboard, /nativeVisibleMetrics/);
  assert.match(dashboard, /sector\.enabledModules\.includes/);
  assert.match(navigation, /enabledKeys \? new Set\(enabledKeys\) : null/);
});

test("Retail uses prioritized dashboard, role-aware actions and mobile lists", async () => {
  const [dashboard, products, sales, css] = await Promise.all([
    read("app/retail/workspace/page.tsx"),
    read("app/retail/workspace/products/page.tsx"),
    read("app/retail/workspace/sales/page.tsx"),
    read("app/retail/retail.css"),
  ]);
  for (const contract of ["DashboardMetricCard", "DashboardMetricGrid", "DashboardCriticalException", "بيع جديد", "تسجيل مصروف"])
    assert.ok(dashboard.includes(contract), contract);
  assert.match(dashboard, /role !== "VIEWER"/);
  assert.match(products, /data-mobile="list"/);
  assert.match(sales, /data-label="الفاتورة"/);
  assert.match(css, /data-mobile="list"/);
  assert.match(css, /var\(--md-surface\)/);
  assert.doesNotMatch(css, /color-scheme: dark|--mr-bg/);
});

test("ORBY remains one contextual assistant for all three services", async () => {
  const [retail, workspace] = await Promise.all([
    read("components/retail-v0/layout/RetailWorkspaceShell.tsx"),
    read("app/workspace/orby/page.tsx"),
  ]);
  assert.match(retail, /service=MADAR_RETAIL/);
  assert.match(workspace, /CONNECT_EXISTING/);
  assert.match(workspace, /BUILD_ON_MADAR/);
  assert.match(workspace, /\/orby\?conversation=new/);
});

test("stage 5 documentation records mobile translation and honest production gaps", async () => {
  const document = await read("docs/MADAR_SERVICES_EXPERIENCE_5.md");
  for (const section of ["Retail IA", "Connected IA", "Native IA", "ORBY context behavior", "Mobile App Translation Notes", "Production truth and known gaps", "Deferred to ORBY Experience 6.0"])
    assert.ok(document.includes(section), section);
});
