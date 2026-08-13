import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("account, retail and business workspaces adapt one canonical global shell", async () => {
  const [global, account, retail, business] = await Promise.all([
    read("components/shell/MadarGlobalShell.tsx"),
    read("components/account/AccountShell.tsx"),
    read("components/retail-v0/layout/RetailWorkspaceShell.tsx"),
    read("components/workspace/EnterpriseWorkspaceShell.tsx"),
  ]);
  for (const adapter of [account, retail, business]) {
    assert.match(adapter, /MadarGlobalShell/);
    assert.doesNotMatch(adapter, /md-ux-sidebar|md-ux-topbar|md-mobile-bottom-nav|<Sheet/);
  }
  for (const contract of ["md-ux-sidebar", "md-ux-topbar", "md-mobile-bottom-nav", "MadarLayerNavigation", "GlobalUserActions", "NavigationControls"])
    assert.ok(global.includes(contract), contract);
});

test("layer navigation separates platform, commerce and contextual workspace navigation", async () => {
  const [layer, navigation] = await Promise.all([
    read("components/shell/MadarLayerNavigation.tsx"),
    read("src/lib/ux/platform-navigation.ts"),
  ]);
  for (const route of ["/account", "/account/services", "/orby", "/store", "/account/purchases", "/account/subscriptions", "/account/notifications"])
    assert.ok(navigation.includes(route), route);
  assert.match(layer, /contextGroups/);
  assert.match(layer, /context\.options/);
  assert.match(layer, /aria-current/);
});

test("mobile is an independent four-destination layer plus More and safe areas", async () => {
  const [shell, css] = await Promise.all([
    read("components/shell/MadarGlobalShell.tsx"),
    read("app/global-shell-3.css"),
  ]);
  assert.match(shell, /mobileItems\.slice\(0, 4\)/);
  assert.match(shell, /<span>المزيد<\/span>/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  for (const breakpoint of ["1023px", "767px", "389px", "1440px"])
    assert.ok(css.includes(breakpoint), breakpoint);
});

test("workspace switching is server-authorized before the HttpOnly selection cookie", async () => {
  const [route, source, selection] = await Promise.all([
    read("app/account/workspaces/[organizationId]/open/route.ts"),
    read("src/lib/shell/server.ts"),
    read("src/lib/workspace-selection.ts"),
  ]);
  assert.match(source, /user_id=eq/);
  assert.match(source, /activation_state !== "ACTIVE"/);
  assert.match(route, /organization_members/);
  assert.match(route, /workspace_subscriptions/);
  assert.match(route, /authorizeOrganizationAction/);
  assert.match(route, /response\.cookies\.set/);
  assert.match(selection, /httpOnly: true/);
});

test("one cached shell identity feeds avatar, recent notifications and authorized services", async () => {
  const [server, accountLayout, workspaceLayout, retailLayout, navbar] = await Promise.all([
    read("src/lib/shell/server.ts"),
    read("app/account/layout.tsx"),
    read("app/workspace/layout.tsx"),
    read("app/retail/workspace/layout.tsx"),
    read("components/layout/Navbar.tsx"),
  ]);
  assert.match(server, /cache\(async/);
  assert.match(server, /limit=5/);
  for (const consumer of [accountLayout, workspaceLayout, retailLayout, navbar])
    assert.match(consumer, /ShellIdentity|shellIdentity|identity/i);
});

test("ORBY remains one assistant with platform layers and active service context", async () => {
  const [page, shell, actions] = await Promise.all([
    read("app/orby/page.tsx"),
    read("components/orby/OrbyShell.tsx"),
    read("components/platform/GlobalUserActions.tsx"),
  ]);
  assert.match(page, /activeOption/);
  assert.match(page, /ShellContextDefinition/);
  assert.match(shell, /MadarLayerNavigation/);
  assert.match(shell, /GlobalUserActions/);
  assert.match(shell, /showOrby=\{false\}/);
  assert.match(actions, /notifications/);
});

test("deep links, back fallback, loading and recoverable errors preserve navigation", async () => {
  const [proxy, controls, accountError, retailError, orbyLoading] = await Promise.all([
    read("proxy.ts"),
    read("components/navigation/NavigationControls.tsx"),
    read("app/account/error.tsx"),
    read("app/retail/workspace/error.tsx"),
    read("app/orby/loading.tsx"),
  ]);
  assert.match(proxy, /searchParams\.set\('next',next\)/);
  assert.match(controls, /fallbackHref/);
  assert.match(controls, /document\.referrer/);
  assert.match(accountError, /reset/);
  assert.match(retailError, /reset/);
  assert.match(orbyLoading, /Skeleton/);
});

test("stage 3 is documented without changing database schema or domain engines", async () => {
  const document = await read("docs/MADAR_GLOBAL_SHELL.md");
  for (const section of ["Global Shell", "Top bar", "تبديل الخدمة والمساحة", "Workspace Shell", "Desktop وMobile", "ORBY", "Accessibility", "حدود المرحلة"])
    assert.ok(document.includes(section), section);
  assert.match(document, /ORBY Core لم يتغير/);
});
