import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("workspace and admin use intentional app-shell architectures", async () => {
  const [workspace, globalShell, admin, navigation] = await Promise.all([
    read("components/workspace/EnterpriseWorkspaceShell.tsx"),
    read("components/shell/MadarGlobalShell.tsx"),
    read("components/admin/EnterpriseAdminShell.tsx"),
    read("src/lib/ux/navigation.ts"),
  ]);
  assert.match(workspace, /MadarGlobalShell/);
  for (const shell of [globalShell, admin]) {
    assert.match(shell, /md-ux-shell/);
    assert.match(shell, /WorkspaceCommandPalette/);
    assert.match(shell, /md-mobile-bottom-nav/);
    assert.match(shell, /ShellModuleContext/);
  }
  assert.doesNotMatch(navigation, /studentNavigationGroups/);
  assert.match(navigation, /adminNavigationGroups/);
  assert.match(navigation, /مركز قيادة المؤسس/);
});

test("remaining workspace modules inherit contextual headers and adaptive surfaces", async () => {
  const shell = await read("components/shell/MadarGlobalShell.tsx");
  assert.match(shell, /md-adaptive-module-surface/);
  assert.match(shell, /nativeHeaderRoutes/);
  assert.match(shell, /ShellModuleContext/);
});

test("public pages share grouped navigation and one content architecture", async () => {
  const [navbar, footer, pageShell, section, routeSurface] = await Promise.all([
    read("components/layout/NavbarClient.tsx"),
    read("components/layout/Footer.tsx"),
    read("components/ui/PageShell.tsx"),
    read("components/ui/Section.tsx"),
    read("components/layout/RouteSurface.tsx"),
  ]);
  assert.match(navbar, /publicGroups/);
  assert.match(navbar, /md-public-nav-group/);
  assert.match(footer, /md-public-footer-links/);
  assert.match(pageShell, /md-public-shell/);
  assert.match(section, /md-public-page-hero/);
  assert.match(routeSurface, /madarSurface/);
});

test("universal rollout includes loading, recovery, and responsive contracts", async () => {
  const [css, rootLoading, rootError, adminError] = await Promise.all([
    read("app/ux-universal-rollout.css"),
    read("app/loading.tsx"),
    read("app/error.tsx"),
    read("app/admin/error.tsx"),
  ]);
  assert.match(css, /md-shell-module-context/);
  assert.match(css, /md-public-mobile-nav/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(rootLoading, /md-route-loading/);
  assert.match(rootError, /إعادة المحاولة/);
  assert.match(adminError, /لم يُنفّذ أي إجراء/);
});
