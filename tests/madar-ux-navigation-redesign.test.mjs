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
  const [adapter, source, layer] = await Promise.all([
    read("components/workspace/EnterpriseWorkspaceShell.tsx"),
    read("components/shell/MadarGlobalShell.tsx"),
    read("components/shell/MadarLayerNavigation.tsx"),
  ]);
  assert.match(adapter, /MadarGlobalShell/);
  assert.match(source, /WorkspaceCommandPalette/);
  assert.match(source, /md-mobile-bottom-nav/);
  assert.match(layer, /account\/services/);
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

test("ORBY preserves business context while converging on the single account assistant", async () => {
  const source = await read("app/workspace/orby/page.tsx");
  assert.match(source, /requireBusinessWorkspace/);
  assert.match(source, /workspace\.id/);
  assert.match(source, /redirect\(`\/orby\?conversation=new&organization=/);
  assert.doesNotMatch(source, /<OrbyChat/);
});

test("workspace has loading and recoverable error boundaries", async () => {
  assert.match(await read("app/workspace/loading.tsx"), /aria-busy/);
  assert.match(await read("app/workspace/error.tsx"), /reset/);
  assert.match(await read("app/globals.css"), /ux-navigation-redesign\.css/);
});
