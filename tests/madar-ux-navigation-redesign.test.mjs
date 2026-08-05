import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("workspace navigation is grouped by user intent", async () => {
  const source = await read("src/lib/v2/navigation.ts");
  for (const group of ["overview", "operations", "automation", "management", "account"]) assert.match(source, new RegExp(`key: \"${group}\"`));
  assert.match(source, /workspaceMobileNavigation/);
  assert.match(source, /المساعد الذكي داخل سياق العمل/);
});

test("unified shell includes command search and real mobile navigation", async () => {
  const source = await read("components/workspace/EnterpriseWorkspaceShell.tsx");
  assert.match(source, /WorkspaceCommandPalette/);
  assert.match(source, /md-mobile-bottom-nav/);
  assert.match(source, /تبديل أو إدارة المساحات/);
  assert.match(source, /NavigationControls showBreadcrumbs=\{false\}/);
});

test("entity lists use route-addressable drawers", async () => {
  for (const path of ["app/workspace/products/page.tsx", "app/workspace/customers/page.tsx", "app/workspace/suppliers/page.tsx"]) {
    const source = await read(path);
    assert.match(source, /WorkspaceDrawer/);
    assert.match(source, /panel=new/);
    assert.match(source, /WorkspaceToolbar/);
    assert.match(source, /md-entity-table/);
  }
});

test("ORBY remains inside the business context", async () => {
  const source = await read("app/workspace/orby/page.tsx");
  assert.match(source, /xl:grid-cols-\[15rem_minmax\(0,1fr\)_20rem\]/);
  assert.match(source, /سياق العمل/);
  assert.match(source, /التنبيهات والفرص/);
  assert.match(source, /إجراء بموافقتك/);
});

test("workspace has loading and recoverable error boundaries", async () => {
  assert.match(await read("app/workspace/loading.tsx"), /aria-busy/);
  assert.match(await read("app/workspace/error.tsx"), /reset/);
  assert.match(await read("app/globals.css"), /ux-navigation-redesign\.css/);
});
