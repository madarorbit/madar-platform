import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("valid sessions refresh automatically and resume the last protected page", async () => {
  const [proxy, auth, navigation] = await Promise.all([
    read("proxy.ts"),
    read("app/actions/auth.ts"),
    read("components/navigation/NavigationExperience.tsx"),
  ]);
  assert.match(proxy, /grant_type=refresh_token/);
  assert.match(proxy, /madar-refresh-token/);
  assert.match(proxy, /madar-last-path/);
  assert.match(proxy, /loginRedirect\(request\)/);
  assert.match(auth, /SESSION_MAX_AGE/);
  assert.match(auth, /rememberedPath/);
  assert.match(
    auth,
    /safeReturnTo\([\s\S]*String\(form\.get\(["']next["']\)\s*\|\|\s*last/,
  );
  assert.match(navigation, /localStorage\.setItem\('madar-last-path'/);
});

test("enterprise navigation exposes history controls, breadcrumbs, progress and scroll restoration", async () => {
  const [controls, experience, css] = await Promise.all([
    read("components/navigation/NavigationControls.tsx"),
    read("components/navigation/NavigationExperience.tsx"),
    read("app/ux-launch-polish.css"),
  ]);
  assert.match(controls, /router\.back\(\)/);
  assert.match(controls, /window\.history\.forward\(\)/);
  assert.match(controls, /مسار الصفحة/);
  assert.match(experience, /sessionStorage\.setItem/);
  assert.match(experience, /scrollTo/);
  assert.match(css, /\.md-route-progress/);
  assert.match(css, /md-page-enter/);
});

test("account services and business space have focused navigation", async () => {
  const [accountPage, accountServer, workspaceShell, workspacePage, nativeOverview, workspaceNavigation] = await Promise.all([
    read("app/account/page.tsx"),
    read("src/lib/account/server.ts"),
    read("components/workspace/EnterpriseWorkspaceShell.tsx"),
    read("app/workspace/page.tsx"),
    read("components/native/NativeDecisionOverview.tsx"),
    read("src/lib/v2/navigation.ts"),
  ]);
  assert.match(accountPage, /getAccountHomeData/);
  assert.match(accountServer, /getAccountServices/);
  assert.match(accountPage, /href="\/account\/services"/);
  assert.doesNotMatch(accountPage, /student|طالب/i);
  assert.match(workspaceShell, /workspaceNavigationGroups/);
  assert.match(workspaceNavigation, /لوحة المعلومات/);
  assert.match(workspacePage, /NativeDecisionOverview/);
  assert.match(nativeOverview, /المؤشرات الأساسية لهذا القطاع/);
});

test("official identity and supplied ORBY artwork are used without a boxed logo placeholder", async () => {
  const [config, logo, orby, css] = await Promise.all([
    read("src/config/site.ts"),
    read("public/brand/logo.svg"),
    read("public/brand/orby-assistant.svg"),
    read("app/ux-launch-polish.css"),
  ]);
  assert.match(config, /name: 'مَدار \| ORBIT'/);
  assert.match(config, /titleTemplate: '%s \| مَدار \| ORBIT'/);
  assert.doesNotMatch(logo, /<rect width="1000" height="1000"/);
  assert.match(logo, /M-11-27A28 28 0 0 0-11 27/);
  assert.match(logo, /M11-27A28 28 0 0 1 11 27/);
  assert.doesNotMatch(logo, /M-5-27A28/);
  assert.match(logo, /مَدار/);
  assert.match(logo, /ORBIT/);
  assert.match(orby, /data:image\/webp;base64/);
  assert.match(orby, /width="256" height="256"/);
  assert.match(css, /md-orby-idle/);
  assert.match(css, /md-orby-breathe/);
  assert.match(css, /prefers-reduced-motion/);
});
