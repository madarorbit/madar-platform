import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const mainMigrationPath = "supabase/migrations/20260811190000_account_services_production.sql";

test("registration creates a MADAR account profile only", async () => {
  const [migration, auth, register, callback] = await Promise.all([
    read(mainMigrationPath),
    read("app/actions/auth.ts"),
    read("components/auth/RegisterWizard.tsx"),
    read("app/auth/google/callback/route.ts"),
  ]);
  const handler = migration.match(/create or replace function private\.handle_new_user_v2\(\)[\s\S]*?\$\$;/i)?.[0] || "";
  assert.match(handler, /insert into public\.profiles/);
  assert.doesNotMatch(handler, /insert into public\.organizations|workspace_subscriptions|trial/);
  assert.match(auth, /data:\s*\{\s*full_name\s*\}/);
  assert.match(auth, /next=\/account/);
  assert.doesNotMatch(register, /sector|specialization|account_type|trial/i);
  assert.doesNotMatch(callback, /new URL\(["']\/(?:account\/setup|onboarding)/);
  assert.doesNotMatch(callback, /complete_initial_onboarding|create_organization_with_owner/);
});

test("the account exposes exactly three independently stateful services", async () => {
  const [catalog, server, account] = await Promise.all([
    read("src/lib/services/catalog.ts"),
    read("src/lib/services/server.ts"),
    read("app/account/page.tsx"),
  ]);
  for (const code of ["CONNECT_EXISTING", "BUILD_ON_MADAR", "MADAR_RETAIL"]) {
    assert.match(catalog, new RegExp(`"${code}"`));
  }
  for (const state of ["NOT_SUBSCRIBED", "SETUP_REQUIRED", "PENDING_APPROVAL", "ACTIVE", "EXPIRED", "SUSPENDED", "REJECTED"]) {
    assert.match(catalog, new RegExp(`"${state}"`));
  }
  assert.match(server, /workspace_subscriptions\?user_id/);
  assert.match(server, /workspace_requests\?user_id/);
  assert.match(account, /getAccountServices/);
  assert.match(account, /صورة الحساب/);
});

test("service subscription, payment and approval state are database driven", async () => {
  const [migration, auditFix, legacyLock, setup, payment, admin, actions] = await Promise.all([
    read(mainMigrationPath),
    read("supabase/migrations/20260811195000_service_config_audit_trigger_fix.sql"),
    read("supabase/migrations/20260811194000_legacy_onboarding_runtime_lock.sql"),
    read("app/account/services/[code]/setup/page.tsx"),
    read("app/workspace-payment/[id]/page.tsx"),
    read("app/admin/workspace-requests/page.tsx"),
    read("app/actions/services.ts"),
  ]);
  assert.match(migration, /subscription_plans_one_per_service_uidx/);
  assert.match(migration, /workspace_subscriptions_user_service_uidx/);
  assert.match(migration, /request_kind in \('ACTIVATION', 'RENEWAL'\)/);
  assert.match(migration, /PAYMENT_PROOF_REQUIRED/);
  assert.match(migration, /service\.request\.' \|\| decision/);
  assert.match(auditFix, /to_jsonb\(old\)|to_jsonb\(new\)/);
  assert.match(auditFix, /service\.payment_method\./);
  assert.match(legacyLock, /complete_existing_customer_onboarding/);
  assert.match(legacyLock, /private\.ensure_student_workspace_impl/);
  assert.match(setup, /service\.plan\.price/);
  assert.match(payment, /payment_methods\?is_active=eq\.true&currency=eq/);
  assert.match(admin, /مشاهدة الإثبات/);
  assert.match(actions, /review_service_request/);
  assert.match(actions, /set_service_subscription_state/);
});

test("Retail provisioning bridges only after central approval and remains retryable", async () => {
  const [mainMigration, delegatedSectorMigration, retailMigration, contextRestoreMigration, action, bridge] = await Promise.all([
    read(mainMigrationPath),
    read("supabase/migrations/20260811192000_service_sector_admin_provisioning.sql"),
    read("supabase/migrations/20260812180836_retail_account_service_activation_unified.sql"),
    read("supabase/migrations/20260812180840_retail_activation_context_restore_unified.sql"),
    read("app/actions/services.ts"),
    read("src/lib/retail/server/service-activation.ts"),
  ]);
  assert.match(mainMigration, /PROVISIONING/);
  assert.match(mainMigration, /finalize_retail_service_activation/);
  assert.match(retailMigration, /caller_role <> 'service_role'/);
  assert.match(retailMigration, /platform_activation_request_id/);
  assert.match(delegatedSectorMigration, /DELEGATED_OWNER_CONTEXT_REQUIRED/);
  assert.match(delegatedSectorMigration, /o\.created_by = actor/);
  assert.match(contextRestoreMigration, /previous_role/);
  assert.match(contextRestoreMigration, /service_role_restored|set_config\('request\.jwt\.claim\.role'/);
  assert.match(action, /activateApprovedRetailService/);
  assert.match(bridge, /RETAIL_SERVICE_PROVISION_FAILED/);
});

test("Student Space and product Beta UI are detached from platform runtime", async () => {
  const [migration, navigation, account, admin, support] = await Promise.all([
    read(mainMigrationPath),
    read("src/lib/ux/navigation.ts"),
    read("app/account/page.tsx"),
    read("app/admin/page.tsx"),
    read("app/admin/support-operations/page.tsx"),
  ]);
  assert.equal(existsSync(new URL("../app/student/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/actions/student.ts", import.meta.url)), false);
  assert.match(migration, /preserved in madarorbit\/madar-student/);
  assert.match(migration, /revoke all on table[\s\S]*public\.student_tasks/);
  assert.doesNotMatch(navigation, /studentNavigationGroups|beta-operations/);
  assert.doesNotMatch(`${account}\n${admin}\n${support}`, /MADAR Beta|نسخة تجريبية|بلاغات Beta/i);
});
