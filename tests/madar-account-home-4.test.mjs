import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("account Home is a priority-based control center, not a service dashboard", async () => {
  const home = await read("app/account/page.tsx");
  for (const contract of ["يحتاج انتباهك", "خدماتي", "اسأل بطريقتك", "الاشتراكات", "آخر التحديثات", "مكتبتي"])
    assert.ok(home.includes(contract), contract);
  assert.match(home, /sortAccountServices/);
  assert.match(home, /attentionForService/);
  assert.doesNotMatch(home, /مبيعات هذا الشهر|المخزون الحالي|إجمالي المبيعات/);
});

test("the three service states drive one truthful CTA source", async () => {
  const [home, cards, catalog, presentation] = await Promise.all([
    read("app/account/page.tsx"),
    read("components/account/ServiceCards.tsx"),
    read("src/lib/services/catalog.ts"),
    read("src/lib/account/presentation.ts"),
  ]);
  assert.match(home, /<ServiceCards services=\{services\} compact/);
  assert.match(cards, /serviceStateCtas\[service\.state\]/);
  for (const state of ["NOT_SUBSCRIBED", "SETUP_REQUIRED", "PENDING_APPROVAL", "ACTIVE", "EXPIRED", "SUSPENDED", "REJECTED"])
    assert.ok(`${catalog}\n${presentation}`.includes(state), state);
  assert.match(cards, /md-service-card-media/);
});

test("account data shares cached shell identity and isolates optional section failures", async () => {
  const [server, services, shell] = await Promise.all([
    read("src/lib/account/server.ts"),
    read("src/lib/services/server.ts"),
    read("src/lib/shell/server.ts"),
  ]);
  assert.match(server, /AccountSection/);
  assert.match(server, /failed: true/);
  assert.match(server, /getOptionalShellIdentity/);
  assert.match(services, /cache\(async/);
  assert.match(shell, /cache\(async/);
});

test("payments, subscriptions, purchases and ORBY remain separate account concepts", async () => {
  const [navigation, payments, subscriptions, orby] = await Promise.all([
    read("src/lib/ux/platform-navigation.ts"),
    read("app/account/payments/page.tsx"),
    read("app/account/subscriptions/page.tsx"),
    read("app/account/orby/page.tsx"),
  ]);
  for (const route of ["/account/payments", "/account/subscriptions", "/account/purchases", "/account/orby"])
    assert.ok(navigation.includes(route), route);
  assert.match(payments, /لم تُجمع العملات/);
  assert.match(subscriptions, /ORBY Plus/);
  assert.match(orby, /الخطة والاستخدام/);
});

test("Home hands a natural starter message to the existing ORBY conversation", async () => {
  const [home, chat] = await Promise.all([read("app/account/page.tsx"), read("components/orby/OrbyChat.tsx")]);
  assert.match(home, /name="starter"/);
  assert.match(home, /action="\/orby"/);
  assert.match(chat, /slice\(0,500\)/);
  assert.match(chat, /useState\(starterText\(starter\)\)/);
});

test("profile uses the existing avatar bucket with preview, replace and safe removal", async () => {
  const [form, actions] = await Promise.all([read("app/account/profile/form.tsx"), read("app/actions/auth.ts")]);
  assert.match(form, /URL\.createObjectURL/);
  assert.match(form, /removeProfileAvatar/);
  assert.match(actions, /storage\/v1\/object\/avatars/);
  assert.match(actions, /avatar_url: null/);
  assert.doesNotMatch(actions, /createBucket|new bucket/i);
});

test("account forms, privacy and support consume semantic Design System primitives", async () => {
  const files = await Promise.all(["app/account/profile/form.tsx", "app/account/privacy/page.tsx", "app/account/support/page.tsx", "app/account/appearance/page.tsx"].map(read));
  for (const source of files) assert.doesNotMatch(source, /bg-\[#|text-slate-|border-white\//);
  assert.match(files[1], /md-danger-zone/);
  assert.match(files[2], /<Field/);
});

test("responsive account contract covers target breakpoints and reduced motion", async () => {
  const [globals, css] = await Promise.all([read("app/globals.css"), read("app/account-home-4.css")]);
  assert.match(globals, /account-home-4\.css/);
  for (const breakpoint of ["1023px", "767px", "389px"]) assert.ok(css.includes(breakpoint), breakpoint);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /md-account-support-layout/);
});

test("stage 4 document records states, behavior, relations and deliberate deferrals", async () => {
  const document = await read("docs/MADAR_ACCOUNT_HOME_4.md");
  for (const section of ["Home hierarchy", "User states", "Account IA", "Desktop وMobile", "Subscriptions وPayments وLibrary", "ORBY", "Accessibility", "Deferred"])
    assert.ok(document.includes(section), section);
});
