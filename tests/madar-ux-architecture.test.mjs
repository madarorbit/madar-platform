import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("account layer owns focused canonical sections and preserves legacy entries", async () => {
  const [layout, navigation, account, legacySubscription, legacySetup, legacyOnboarding] = await Promise.all([
    read("app/account/layout.tsx"),
    read("src/lib/ux/platform-navigation.ts"),
    read("app/account/page.tsx"),
    read("app/account/subscription/page.tsx"),
    read("app/account/setup/page.tsx"),
    read("app/onboarding/page.tsx"),
  ]);
  assert.match(layout, /AccountShell/);
  for (const route of ["/account/services", "/account/subscriptions", "/account/security", "/account/appearance"]) assert.ok(navigation.includes(route));
  assert.match(account, /query\.view === "services"/);
  assert.match(legacySubscription, /redirect\("\/account\/subscriptions"\)/);
  assert.match(legacySetup, /redirect\("\/account\/services"\)/);
  assert.match(legacyOnboarding, /redirect\("\/account\/services"\)/);
});

test("global actions expose ORBY cart notifications and a compact account menu", async () => {
  const [actions, cart] = await Promise.all([
    read("components/platform/GlobalUserActions.tsx"),
    read("components/platform/CartStatusLink.tsx"),
  ]);
  for (const contract of [/orbyHref/, /CartStatusLink/, /account\/notifications/, /account\/services/, /account\/appearance/, /logout/]) assert.match(actions, contract);
  assert.match(cart, /const \{ count \} = useCart\(\)/);
  assert.match(cart, /md-cart-count/);
});

test("workspace navigation separates connected and native intent without exposing Retail", async () => {
  const navigation = await read("src/lib/v2/navigation.ts");
  assert.match(navigation, /CONNECTED_EXTERNAL/);
  assert.match(navigation, /البيانات الواصلة/);
  assert.match(navigation, /المراقبة والتقارير/);
  assert.match(navigation, /الربط والأتمتة/);
  assert.doesNotMatch(navigation, /retail\/workspace/);
});

test("ORBY keeps one identity while its entry and return follow workspace context", async () => {
  const [page, shell, floating] = await Promise.all([
    read("app/orby/page.tsx"),
    read("components/orby/OrbyShell.tsx"),
    read("components/orby/OrbyFloatingFace.tsx"),
  ]);
  assert.match(page, /contextLabel/);
  assert.match(page, /returnHref/);
  assert.match(shell, /\{contextLabel\}/);
  assert.match(floating, /\/workspace\/orby/);
  assert.match(floating, /\/retail\/workspace\/orby/);
});

test("UX architecture is an executable reference rather than a visual redesign", async () => {
  const document = await read("docs/MADAR_UX_ARCHITECTURE.md");
  for (const heading of ["Global IA", "MADAR Retail IA", "Connected Business IA", "Native Business IA", "ORBY", "Route map", "Accessibility baseline", "Known gaps"]) assert.ok(document.includes(heading));
  assert.match(document, /لا يعرّف ألوانًا أو أشكالًا نهائية/);
  assert.match(document, /لم يتغير: Supabase schema/);
});
