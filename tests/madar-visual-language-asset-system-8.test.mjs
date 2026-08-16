import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const file = (path) => readFile(new URL(`../${path}`, import.meta.url));
const text = async (path) => (await file(path)).toString("utf8");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const gitBlobSha = (buffer) => createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${buffer.length}\0`), buffer])).digest("hex");
const u24le = (buffer, offset) => buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
function webpDimensions(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === "VP8X") return [u24le(buffer, data + 4) + 1, u24le(buffer, data + 7) + 1];
    if (type === "VP8L") {
      assert.equal(buffer[data], 0x2f, "invalid VP8L signature");
      const b1 = buffer[data + 1], b2 = buffer[data + 2], b3 = buffer[data + 3], b4 = buffer[data + 4];
      return [1 + (((b2 & 0x3f) << 8) | b1), 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))];
    }
    if (type === "VP8 ") {
      assert.deepEqual([...buffer.subarray(data + 3, data + 6)], [0x9d, 0x01, 0x2a], "invalid VP8 keyframe signature");
      return [buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff];
    }
    offset = data + size + (size % 2);
  }
  assert.fail("WebP dimension chunk missing");
}

test("phase 8 visual asset layer is imported after phase 7", async () => {
  const globals = await text("app/globals.css");
  assert.match(globals, /polish-accessibility-performance-7\.css";\n@import "\.\/visual-language-assets-8\.css"/);
});

test("MADAR locked logo is byte-identical to the pre-phase baseline", async () => {
  const logo = await file("public/brand/logo.svg");
  assert.equal(gitBlobSha(logo), "2e87bf5ec0df8f919880da1e317f074a4830179f");
});

test("four official production derivatives keep full master dimensions and known hashes", async () => {
  const expected = [
    ["public/assets/services/native-business-master.webp", 1254, 1254, "083032838be4edb638d384975a9a667f849b187665512ae2fe4fb423523842ed"],
    ["public/assets/services/madar-retail-master.webp", 1254, 1254, "0f781f4bf2a30507acd24b96fd0c318e76ecb655cbe4a69cacd025fd9d8a4691"],
    ["public/assets/services/connected-business-master.webp", 1254, 1254, "11ce11a0361357138dcfc3a31a6fdda7359ffddc73f342716f2c4ff3271c9bd8"],
    ["public/assets/orby/orby-master.webp", 1536, 1536, "c90707f8f966ccea28c8e7a0c7bcb51feb1446115d9fc5003864c75cf92d92e9"],
  ];
  for (const [path, width, height, hash] of expected) {
    const buffer = await file(path);
    assert.deepEqual(webpDimensions(buffer), [width, height], path);
    assert.equal(sha256(buffer), hash, path);
  }
});

test("service catalog uses full master derivatives without a second optimization pass", async () => {
  const [catalog, cards, css] = await Promise.all([text("src/lib/services/catalog.ts"), text("components/account/ServiceCards.tsx"), text("app/visual-language-assets-8.css")]);
  for (const path of ["connected-business-master.webp", "native-business-master.webp", "madar-retail-master.webp"]) assert.ok(catalog.includes(path), path);
  assert.doesNotMatch(catalog, /\/services\/(connect-existing|build-on-madar|madar-retail)\.webp/);
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
  assert.match(config, /orbyMaster:'\/assets\/orby\/orby-master\.webp'/);
  assert.match(about, /siteConfig\.assets\.orbyMaster/);
  assert.match(about, /width=\{1536\}/);
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
