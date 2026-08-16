import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const file = (path) => readFile(new URL(`../${path}`, import.meta.url));
const text = async (path) => (await file(path)).toString("utf8");
const gitBlobSha = (buffer) => createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${buffer.length}\0`), buffer])).digest("hex");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sofMarkers = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);

function imageDimensions(buffer) {
  if (buffer.subarray(0, 8).equals(pngSignature)) return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  assert.equal(buffer[0], 0xff, "image must be PNG or JPEG");
  assert.equal(buffer[1], 0xd8, "invalid JPEG SOI");
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (sofMarkers.has(marker)) return [buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)];
    offset += length;
  }
  assert.fail("JPEG dimension marker missing");
}

test("phase 8 visual asset layer is imported after phase 7", async () => {
  const globals = await text("app/globals.css");
  assert.match(globals, /polish-accessibility-performance-7\.css";\n@import "\.\/visual-language-assets-8\.css"/);
});

test("MADAR locked logo is byte-identical to the pre-phase baseline", async () => {
  const logo = await file("public/brand/logo.svg");
  assert.equal(gitBlobSha(logo), "2e87bf5ec0df8f919880da1e317f074a4830179f");
});

test("four authoritative masters are checked in at full dimensions and locked repository blobs", async () => {
  const expected = [
    ["public/assets/services/native-business-master.png", 1254, 1254, "5b23af11150f65fe8c79ebce1626468780284984"],
    ["public/assets/services/madar-retail-master.png", 1254, 1254, "41dec7e503401f8a39c5d92e9f475feef9a66d78"],
    ["public/assets/services/connected-business-master.png", 1254, 1254, "34d43f28b9e23ed95e9940b552da55738408b16f"],
    ["public/assets/orby/orby-master.png", 1536, 1536, "a213830b95960f5118596635ce5dd2328a853dbf"],
  ];
  for (const [path, width, height, blob] of expected) {
    const buffer = await file(path);
    assert.deepEqual(imageDimensions(buffer), [width, height], path);
    assert.equal(gitBlobSha(buffer), blob, path);
  }
});

test("obsolete generated master derivatives are no longer shipped", async () => {
  for (const path of [
    "public/assets/services/native-business-master.webp",
    "public/assets/services/madar-retail-master.webp",
    "public/assets/services/connected-business-master.webp",
    "public/assets/orby/orby-master.webp",
  ]) await assert.rejects(file(path), { code: "ENOENT" }, path);
});

test("service catalog uses authoritative masters and cards preserve their composition", async () => {
  const [catalog, cards, css] = await Promise.all([text("src/lib/services/catalog.ts"), text("components/account/ServiceCards.tsx"), text("app/visual-language-assets-8.css")]);
  for (const path of ["connected-business-master.png", "native-business-master.png", "madar-retail-master.png"]) assert.ok(catalog.includes(path), path);
  assert.doesNotMatch(catalog, /master\.webp/);
  for (const size of ["92px", "104px", "120px", "calc(100vw - 2rem)", "50vw", "33vw"]) assert.ok(cards.includes(size), size);
  assert.match(cards, /\bunoptimized\b/);
  assert.doesNotMatch(cards, /object-cover/);
  assert.match(cards, /md-service-master-image/);
  assert.match(css, /aspect-ratio: 1 \/ 1/);
  assert.match(css, /object-fit: contain/);
  assert.match(css, /object-position: center/);
});

test("ORBY has explicit master and compact contracts and About uses the master responsively", async () => {
  const [config, about] = await Promise.all([text("src/config/site.ts"), text("app/about/page.tsx")]);
  assert.match(config, /orbyCompact:'\/brand\/orby-assistant\.svg'/);
  assert.match(config, /orbyMaster:'\/assets\/orby\/orby-master\.png'/);
  assert.match(about, /siteConfig\.assets\.orbyMaster/);
  assert.match(about, /width=\{1536\}/);
  assert.match(about, /height=\{1536\}/);
  assert.match(about, /sizes="\(max-width: 1023px\)/);
  assert.match(about, /\bunoptimized\b/);
});

test("targeted Retail surfaces use the shared functional icon system", async () => {
  const [landing, nav, icons, pkg] = await Promise.all([text("app/retail/page.tsx"), text("components/retail-v0/layout/workspace-nav.tsx"), text("components/ui/Icons.tsx"), text("package.json")]);
  assert.doesNotMatch(landing, /from ["']lucide-react["']/);
  assert.doesNotMatch(nav, /from ["']lucide-react["']/);
  assert.match(landing, /@\/components\/ui\/Icons/);
  assert.match(nav, /@\/components\/ui\/Icons/);
  assert.match(icons, /strokeWidth="1\.8"/);
  assert.doesNotMatch(pkg, /react-icons|fortawesome|heroicons/);
});

test("phase 8 asset presentation uses semantic roles and no hardcoded palette", async () => {
  const css = await text("app/visual-language-assets-8.css");
  assert.match(css, /var\(--md-surface-sunken\)/);
  assert.match(css, /var\(--md-border-default\)/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}|slate-|violet-|emerald-/i);
});

test("locked home identity video keeps its delivery contract", async () => {
  const hero = await text("components/home/Hero.tsx");
  for (const contract of ["autoPlay", "muted", "playsInline", 'preload="metadata"', "siteConfig.assets.identityImage", "siteConfig.assets.identityVideo"]) assert.ok(hero.includes(contract), contract);
});

test("phase 8 documentation records source truth, visual language, and visual QA limits", async () => {
  const [doc, registry] = await Promise.all([text("docs/MADAR_VISUAL_LANGUAGE_ASSET_SYSTEM_8.md"), text("docs/MADAR_ASSET_REGISTRY.md")]);
  for (const phrase of ["Brand Lock", "Visual Asset Audit", "Duotone Line", "Geometric Minimal", "Soft 3D", "ORBY Visual Identity", "pixel-perfect"]) assert.ok(doc.includes(phrase), phrase);
  for (const asset of ["MADAR Logo", "ORBY Master", "Connected Business Service", "Native Business Service", "MADAR Retail Service"]) assert.ok(registry.includes(asset), asset);
});
