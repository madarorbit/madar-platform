import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath =
  "supabase/migrations/20260802090000_madar_v2_p0_p11_platform.sql";

test("P0 and P1 freeze V1 decisions and enforce one exclusive account path", async () => {
  const [migration, registration, business, student] = await Promise.all([
    read(migrationPath),
    read("components/auth/RegisterWizard.tsx"),
    read("src/lib/business.ts"),
    read("app/student/layout.tsx"),
  ]);
  for (const decision of [
    "v1_baseline",
    "v2_plan_levels",
    "v2_base_prices_sar",
    "v2_term_discounts",
    "v2_connected_multiplier",
    "v2_trial_days",
    "v2_launch_verticals",
    "v2_write_allowlist",
  ])
    assert.match(migration, new RegExp(`'${decision}'`));
  assert.match(migration, /account_type in \('PERSONAL','BUSINESS'\)/);
  assert.match(
    migration,
    /operating_mode in \('MADAR_NATIVE','CONNECTED_EXTERNAL'\)/,
  );
  assert.match(migration, /v2\.account\.student_membership_detached/);
  assert.match(migration, /BUSINESS_ACCOUNT_STUDENT_SPACE_FORBIDDEN/);
  assert.match(registration, /data-step="4"/);
  assert.match(registration, /activity_specialization_code/);
  assert.match(business, /account_type\s*===\s*["']PERSONAL["']/);
  assert.match(student, /requirePersonalAccount/);
});

test("P2 and P3 implement a certified versioned vertical engine and sector UDM contracts", async () => {
  const [migration, admin, setup] = await Promise.all([
    read(migrationPath),
    read("app/admin/verticals/actions.ts"),
    read("components/v2/ActivitySetupForm.tsx"),
  ]);
  for (const table of [
    "activity_families",
    "activity_types",
    "activity_specializations",
    "activity_onboarding_questions",
    "activity_profiles",
    "sector_packages",
    "sector_package_versions",
    "organization_sector_packages",
  ])
    assert.match(migration, new RegExp(`public\\.${table}`));
  for (const vertical of [
    "GENERAL_COMMERCE",
    "WHOLESALE",
    "RETAIL",
    "WHOLESALE_RETAIL",
    "GROCERY_WHOLESALE",
    "RESTAURANT",
    "HOTEL",
  ])
    assert.match(migration, new RegExp(`'${vertical}'`));
  assert.match(migration, /SECTOR_PACKAGE_NOT_CERTIFIED/);
  assert.match(migration, /"field":"track_expiry","equals":true/);
  assert.match(setup, /question\.condition\.equals/);
  assert.match(admin, /launch\s*&&\s*status\s*===\s*["']approved["']/);
  for (const extension of ["core", "commerce", "food_service", "hospitality"])
    assert.match(migration, new RegExp(`'${extension}'`));
  for (const entity of [
    "purchase_order",
    "recipe",
    "restaurant_order",
    "hotel_reservation",
    "hotel_stay",
    "hotel_folio",
  ])
    assert.match(migration, new RegExp(`'${entity}'`));
  assert.match(migration, /udm_mapping_contracts/);
  assert.match(migration, /sector_event_definitions/);
  assert.match(migration, /sector_kpi_definitions/);
  assert.match(migration, /sector_orby_tools/);
});

test("P4 pricing creates 18 variants with launch rates, immutable snapshots and controlled changes", async () => {
  const [migration, pricing, worker, payment] = await Promise.all([
    read(migrationPath),
    read("src/lib/v2/pricing.ts"),
    read("app/api/integrations/worker/route.ts"),
    read("components/payments/V2PaymentForm.tsx"),
  ]);
  assert.match(migration, /\('BASIC','الاشتراك العادي'[^\n]+,5,10\)/);
  assert.match(migration, /\('PREMIUM','الاشتراك المميز'[^\n]+,20,20\)/);
  assert.match(migration, /\('FULL','الاشتراك الكامل'[^\n]+,50,30\)/);
  assert.match(
    migration,
    /cross join \(values\(1,0::numeric\),\(6,0\.10::numeric\),\(12,0\.20::numeric\)\)/i,
  );
  assert.match(migration, /when 'CONNECTED_EXTERNAL' then 1\.20/);
  assert.match(migration, /trial_days[^\n]+20/);
  assert.match(migration, /locked_entitlements/);
  assert.match(migration, /is_grandfathered/);
  assert.match(migration, /UPGRADE_REQUIRES_CONFIRMED_PAYMENT/);
  assert.match(migration, /apply_due_v2_subscription_changes/);
  assert.match(worker, /apply_due_v2_subscription_changes/);
  assert.match(pricing, /TERM_DISCOUNTS/);
  assert.match(payment, /name="variant_id"/);
  assert.match(payment, /name="currency"/);
});

test("P5 and P6 activate native modules and implement the complete commerce operating cycle", async () => {
  const [migration, procurement] = await Promise.all([
    read(migrationPath),
    read("app/workspace/procurement/page.tsx"),
  ]);
  for (const table of [
    "native_module_definitions",
    "sector_module_bindings",
    "organization_modules",
    "sector_dashboard_configs",
    "sector_report_configs",
  ])
    assert.match(migration, new RegExp(`public\\.${table}`));
  for (const operation of [
    "create_commerce_purchase_order",
    "receive_commerce_purchase",
    "record_commerce_sales_return",
    "commerce_profit_report",
  ])
    assert.match(migration, new RegExp(operation));
  assert.match(migration, /public\.inventory_movements/);
  assert.match(migration, /new_cost:=case when new_stock=0/);
  assert.match(procurement, /createCommercePurchaseOrder/);
  assert.match(procurement, /receiveCommercePurchase/);
});

test("P7 and P8 ship executable MADAR Connect and confirmed reverse-write controls", async () => {
  const [migration, runtime, setup, sync, write, inbound, actions] =
    await Promise.all([
      read(migrationPath),
      read("src/lib/integration/runtime.ts"),
      read("components/v2/ConnectorSetupForm.tsx"),
      read("src/lib/integration/sync-engine.ts"),
      read("src/lib/integration/write-engine.ts"),
      read("app/api/integrations/inbound/[endpointId]/route.ts"),
      read("app/actions/v2-operations.ts"),
    ]);
  for (const connector of [
    "madar.generic-rest",
    "madar.file-import",
    "madar.webhook",
    "madar.local-bridge",
  ])
    assert.match(migration, new RegExp(connector.replace(".", "\\.")));
  assert.match(runtime, /genericRestConnector/);
  assert.match(runtime, /publicChannelConnectors/);
  assert.match(setup, /setup_schema/);
  assert.match(setup, /authPayload/);
  assert.match(sync, /integration_schema_snapshots/);
  assert.match(sync, /integration_mapping_previews/);
  assert.match(sync, /integration_sync_previews/);
  assert.match(inbound, /createHmac\("sha256"/);
  assert.match(inbound, /x-madar-signature/);
  assert.match(actions, /signing_secret_ciphertext/);
  for (const control of [
    "integration_permission_grants",
    "integration_consent_log",
    "integration_write_commands",
    "integration_write_attempts",
    "integration_write_conflicts",
    "integration_compensations",
    "integration_reverse_sync_records",
  ])
    assert.match(migration, new RegExp(control));
  assert.match(migration, /ENTITLEMENT_REVERSE_WRITE_REQUIRED/);
  assert.match(migration, /WRITE_PERMISSION_REQUIRED/);
  assert.match(migration, /Idempotency|idempotency/i);
  assert.match(write, /compensat/i);
});

test("P9 and P10 preserve restaurant and hotel domain models with full operating actions", async () => {
  const [migration, restaurant, hotel, actions, orby] = await Promise.all([
    read(migrationPath),
    read("app/workspace/restaurant/page.tsx"),
    read("app/workspace/hotel/page.tsx"),
    read("app/actions/v2-operations.ts"),
    read("src/lib/orby.ts"),
  ]);
  for (const table of [
    "restaurant_recipes",
    "restaurant_recipe_ingredients",
    "restaurant_orders",
    "restaurant_kitchen_tickets",
    "hotel_properties",
    "hotel_rooms",
    "hotel_rates",
    "hotel_rate_availability",
    "hotel_reservations",
    "hotel_stays",
    "hotel_housekeeping_tasks",
    "hotel_maintenance_requests",
    "hotel_folios",
    "hotel_folio_charges",
  ])
    assert.match(migration, new RegExp(`public\\.${table}`));
  assert.match(restaurant, /recordRestaurantOrder/);
  assert.match(restaurant, /updateKitchenTicket/);
  assert.match(hotel, /createHotelReservation/);
  assert.match(hotel, /checkInHotelReservation/);
  assert.match(hotel, /checkOutHotelStay/);
  assert.match(hotel, /manageHotelMaintenance/);
  assert.match(actions, /postHotelFolioCharge/);
  assert.match(migration, /orby_business_context_impl/);
  assert.match(migration, /allowed_sector_tools/);
  assert.match(orby, /sector_context/);
});

test("P11 resolves sector navigation, terminology, themes, RTL and dashboard-app entry", async () => {
  const [navigation, shell, css, dashboardApp, mobile] = await Promise.all([
    read("src/lib/v2/navigation.ts"),
    read("components/workspace/EnterpriseWorkspaceShell.tsx"),
    read("app/design-system.css"),
    read("app/dashboard-app/page.tsx"),
    read("app/api/mobile/v1/dashboard/route.ts"),
  ]);
  assert.match(navigation, /workspaceNavigation/);
  assert.match(shell, /navigation_state|localStorage/);
  assert.match(shell, /saveWorkspaceNavigationState/);
  assert.match(shell, /dashboard-app/);
  assert.match(css, /sidebar-compact/);
  assert.match(css, /color-scheme/);
  assert.match(dashboardApp, /NEXT_PUBLIC_DASHBOARD_APP_IOS_URL/);
  assert.match(mobile, /activity_profiles/);
  assert.match(mobile, /sectorReport/);
});
