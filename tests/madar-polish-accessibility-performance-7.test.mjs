import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("phase 7 polish layer is last and keeps 44px interaction targets",async()=>{
 const[globals,css,tokens]=await Promise.all([read("app/globals.css"),read("app/polish-accessibility-performance-7.css"),read("app/design-tokens.css")]);
 assert.match(globals,/orby-experience-6\.css";\n@import "\.\/polish-accessibility-performance-7\.css"/);
 assert.match(tokens,/--md-size-touch:\s*2\.75rem/);
 assert.match(css,/\.md-page-button \{ width: var\(--md-size-touch\); height: var\(--md-size-touch\); \}/);
 assert.match(css,/\.md-menu-panel a,[\s\S]*min-height: var\(--md-size-touch\)/);
});

test("theme motion follows the design token and reduced motion remains authoritative",async()=>{
 const[provider,css,system]=await Promise.all([read("components/theme/ThemeProvider.tsx"),read("app/polish-accessibility-performance-7.css"),read("app/design-system.css")]);
 assert.match(provider,/TRANSITION_DURATION=320/);
 assert.match(css,/prefers-reduced-motion: reduce/);
 assert.match(system,/prefers-reduced-motion: reduce/);
});

test("menus expose controlled popup relationships and keyboard entry",async()=>{
 const menu=await read("components/ui/EnterpriseClient.tsx");
 assert.match(menu,/aria-controls=\{panelId\}/);
 assert.match(menu,/ArrowDown/);
 assert.match(menu,/ArrowUp/);
 assert.match(menu,/buttonRef\.current\?\.focus\(\)/);
});

test("ORBY keeps offline drafts editable and removes empty stopped responses",async()=>{
 const orby=await read("components/orby/OrbyChat.tsx");
 assert.match(orby,/disabled=\{blocked\}/);
 assert.doesNotMatch(orby,/disabled=\{blocked\|\|!online\}/);
 assert.match(orby,/يمكنك متابعة كتابة المسودة/);
 assert.match(orby,/AbortError'\)\{if\(!preserveAssistant\)setMessages/);
 assert.match(orby,/navigator\.clipboard\.writeText/);
 assert.match(orby,/تعذر النسخ تلقائيًا/);
});

test("checkout uses semantic MADAR controls and explicit multi-currency feedback",async()=>{
 const checkout=await read("components/cart/CheckoutForm.tsx");
 for(const primitive of ["Button","Field","Input","Notice","Panel"])assert.ok(checkout.includes(primitive),primitive);
 assert.match(checkout,/inputMode="tel"/);
 assert.match(checkout,/الخطوة 1 من 2/);
 assert.match(checkout,/أكثر من عملة/);
 assert.doesNotMatch(checkout,/bg-white|text-slate|bg-red|text-red|bg-amber|text-amber/);
});

test("global error and not-found states are theme semantic",async()=>{
 const[error,notFound]=await Promise.all([read("app/error.tsx"),read("app/not-found.tsx")]);
 for(const source of [error,notFound]){
  assert.match(source,/md-(panel|empty|error)/);
  assert.doesNotMatch(source,/text-slate|bg-white|rose-|violet-/);
 }
 assert.match(error,/role="alert"/);
});

test("performance contracts preserve request parallelism and virtualized ORBY history",async()=>{
 const[account,orbyCss]=await Promise.all([read("src/lib/account/server.ts"),read("app/orby-experience-6.css")]);
 assert.match(account,/cache\(async/);
 assert.match(account,/Promise\.all\(/);
 assert.match(orbyCss,/content-visibility: auto/);
 assert.match(orbyCss,/contain-intrinsic-size/);
});

test("phase 7 documentation records measurement limits and phase 8 boundaries",async()=>{
 const doc=await read("docs/MADAR_POLISH_ACCESSIBILITY_PERFORMANCE_7.md");
 for(const section of ["Audit baseline","Accessibility baseline","Responsive QA","Performance baseline","Lighthouse / Web Vitals","Known gaps","Mobile readiness","المرحلة الثامنة"])assert.ok(doc.includes(section),section);
 assert.match(doc,/لم تُخترع أرقام Lighthouse/);
});