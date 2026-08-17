import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GuideRegistry, GuidedLearningRuntime, MemoryLearningProgressStore, defineGuideTargetId } from "../src/lib/guided-learning/index.ts";
import {
  GuidedLearningController,
  computeCutoutBlockers,
  computeGuidePlacement,
  computeSpotlightGeometry,
  isGuideTargetVisible,
  measureGuideTarget,
  pointerPolicyForStep,
  resolveGuideTarget,
  scrollGuideTargetIntoView,
  targetSelector,
} from "../src/lib/guided-learning/browser/index.ts";
import { phase2EngineFixture } from "../src/lib/guided-learning/testing/phase-2-engine-fixture.ts";

const rect = (top=40,left=60,width=100,height=50) => ({ top, left, right:left+width, bottom:top+height, width, height });
const style = (display="block", visibility="visible", opacity="1") => ({ display, visibility, opacity });
const id = defineGuideTargetId("phase2.fixture.button");

function fakeElement(options: { connected?: boolean; rect?: ReturnType<typeof rect>; display?: string } = {}) {
  const value = options.rect ?? rect();
  return {
    isConnected: options.connected ?? true,
    getBoundingClientRect: () => value,
    getAttribute: () => id,
    scrollIntoView: () => undefined,
  } as unknown as Element;
}

test("target resolver uses the stable MADAR attribute and resolves a visible target", () => {
  const element = fakeElement();
  const root = { querySelector: (selector: string) => selector === targetSelector(id) ? element : null } as unknown as ParentNode;
  const result = resolveGuideTarget(id, { root, getStyle: () => style(), getRect: () => rect(), isConnected: () => true });
  assert.equal(result.state, "resolved");
  assert.equal(result.element, element);
  assert.equal(targetSelector(id), `[data-madar-guide="phase2.fixture.button"]`);
});

test("target resolver distinguishes missing, hidden and detached", () => {
  const missingRoot = { querySelector: () => null } as unknown as ParentNode;
  assert.equal(resolveGuideTarget(id, { root: missingRoot }).state, "missing");
  const hidden = fakeElement();
  const hiddenRoot = { querySelector: () => hidden } as unknown as ParentNode;
  assert.equal(resolveGuideTarget(id, { root: hiddenRoot, getStyle: () => style("none"), getRect: () => rect(), isConnected: () => true }).state, "hidden");
  const detached = fakeElement({ connected: false });
  const detachedRoot = { querySelector: () => detached } as unknown as ParentNode;
  assert.equal(resolveGuideTarget(id, { root: detachedRoot, getStyle: () => style(), getRect: () => rect(), isConnected: () => false }).state, "detached");
});

test("geometry extraction and spotlight padding are deterministic and viewport-clamped", () => {
  const element = fakeElement({ rect: rect(4, 6, 100, 50) });
  const measured = measureGuideTarget(element, () => rect(4, 6, 100, 50));
  assert.deepEqual({ centerX: measured.centerX, centerY: measured.centerY }, { centerX: 56, centerY: 29 });
  const spotlight = computeSpotlightGeometry(measured, { width: 120, height: 80 }, { padding: 10, radius: 20 });
  assert.equal(spotlight.top, 0);
  assert.equal(spotlight.left, 0);
  assert.equal(spotlight.right, 116);
  assert.equal(spotlight.bottom, 64);
  assert.equal(spotlight.radius, 20);
});

test("viewport visibility respects safe insets and margins", () => {
  const viewport = { width: 800, height: 600, topInset: 64, bottomInset: 40 };
  assert.equal(isGuideTargetVisible(rect(100, 100, 100, 50), viewport, 20), true);
  assert.equal(isGuideTargetVisible(rect(65, 100, 100, 50), viewport, 20), false);
});

test("auto-scroll only runs for offscreen targets", async () => {
  let scrolls = 0;
  const visible = { isConnected:true, getBoundingClientRect:()=>rect(100,100,100,50), scrollIntoView:()=>{scrolls++;} } as unknown as Element;
  assert.equal(await scrollGuideTargetIntoView(visible, { viewport:{width:800,height:600}, reducedMotion:true }), false);
  const offscreen = { isConnected:true, getBoundingClientRect:()=>rect(900,100,100,50), scrollIntoView:()=>{scrolls++;} } as unknown as Element;
  assert.equal(await scrollGuideTargetIntoView(offscreen, { viewport:{width:800,height:600}, reducedMotion:true }), true);
  assert.equal(scrolls, 1);
});

test("RTL start/end placement maps to physical sides correctly", () => {
  const common = { target: rect(200,300,100,50), viewport:{width:1000,height:700}, surface:{width:200,height:120}, direction:"rtl" as const };
  assert.equal(computeGuidePlacement({ ...common, requested:"start" }).placement, "right");
  assert.equal(computeGuidePlacement({ ...common, requested:"end" }).placement, "left");
});

test("auto placement stays inside viewport and cutout blockers leave the target hole open", () => {
  const placement = computeGuidePlacement({ target:rect(10,10,80,40), viewport:{width:320,height:480}, surface:{width:220,height:140}, requested:"auto", direction:"rtl" });
  assert.ok(placement.x >= 16 && placement.y >= 16);
  const blockers = computeCutoutBlockers(rect(100,80,120,60), {width:320,height:480});
  assert.equal(blockers.length, 4);
  assert.equal(blockers.some((item) => item.left === 80 && item.top === 100), false);
});

test("pointer policy differentiates blocking and interactive steps", () => {
  const first = phase2EngineFixture.journeys[0].steps[0];
  const interactive = phase2EngineFixture.journeys[0].steps[1];
  assert.equal(pointerPolicyForStep(first), "block_background");
  assert.equal(pointerPolicyForStep(interactive), "allow_target");
});

test("UI controller derives its snapshot from the Phase 1 runtime and navigates without parallel state", async () => {
  const registry = new GuideRegistry();
  registry.register(phase2EngineFixture);
  const runtime = new GuidedLearningRuntime({ registry, progressStore:new MemoryLearningProgressStore() });
  const controller = new GuidedLearningController(runtime, registry, { accountId:"phase2-test-account" });
  let notices = 0;
  controller.subscribe(() => notices++);
  await controller.startGuide(phase2EngineFixture.id);
  assert.equal(controller.getSnapshot().step?.id, phase2EngineFixture.journeys[0].steps[0].id);
  await controller.nextStep();
  assert.equal(controller.getSnapshot().step?.id, phase2EngineFixture.journeys[0].steps[1].id);
  await controller.nextStep();
  await controller.nextStep();
  assert.equal(controller.getSnapshot().runtime.phase, "completed");
  assert.ok(notices >= 4);
});

test("Phase 2 fixture remains test-only and production boundary registers no guide", () => {
  const boundary = readFileSync("components/guided-learning/GuidedLearningBoundary.tsx", "utf8");
  const accountLayout = readFileSync("app/account/layout.tsx", "utf8");
  assert.equal(boundary.includes("phase2EngineFixture"), false);
  assert.match(boundary, /new GuideRegistry\(\)/);
  assert.match(accountLayout, /GuidedLearningBoundary/);
});

test("host uses scoped cleanup, portal, reduced-motion-aware scrolling and no polling loop", () => {
  const host = readFileSync("components/guided-learning/GuidedLearningHost.tsx", "utf8");
  const engine = readFileSync("src/lib/guided-learning/browser/engine.ts", "utf8");
  assert.match(host, /createPortal/);
  assert.match(host, /prefers-reduced-motion/);
  assert.match(host, /stopTracking\?\.\(\)/);
  assert.match(host, /removeEventListener\("keydown"/);
  assert.equal(engine.includes("setInterval("), false);
  assert.match(engine, /observer\.disconnect\(\)/);
  assert.match(engine, /resizeObserver\?\.disconnect\(\)/);
});

test("spotlight CSS uses MADAR semantic tokens, smooth geometry and reduced motion without hardcoded palette", () => {
  const css = readFileSync("app/guided-learning-2.css", "utf8");
  assert.match(css, /100vmax var\(--md-backdrop\)/);
  assert.match(css, /var\(--md-mint\)/);
  assert.match(css, /var\(--md-accent\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.equal(/#[0-9a-f]{3,8}/i.test(css), false);
});
