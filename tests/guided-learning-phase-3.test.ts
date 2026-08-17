import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ORBYCharacterRuntime,
  createORBYMotionPlan,
  directionFromPlacement,
  mapGuideIntentToORBY,
  resolveGuideDirection,
  resolveORBYPresentationRequest,
  semanticDirectionFromPhysical,
} from "../src/lib/guided-learning/character/index.ts";
import { phase3OrbyPresentationFixture } from "../src/lib/guided-learning/testing/phase-3-orby-presentation-fixture.ts";

function manualScheduler() {
  let next = 1;
  const pending = new Map<ReturnType<typeof setTimeout>, () => void>();
  return {
    scheduler: {
      set(callback: () => void) {
        const handle = next++ as unknown as ReturnType<typeof setTimeout>;
        pending.set(handle, callback);
        return handle;
      },
      clear(handle: ReturnType<typeof setTimeout>) {
        pending.delete(handle);
      },
    },
    flush() {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
    },
    size() { return pending.size; },
  };
}

test("Phase 1 semantic intents map to technology-neutral ORBY motion intents", () => {
  for (const intent of ["idle", "point", "attention", "confirm", "celebrate", "thinking"] as const) {
    assert.equal(mapGuideIntentToORBY(intent), intent);
  }
  assert.equal(mapGuideIntentToORBY("custom:future-pose"), "idle");
});

test("physical direction converts to semantic inline direction in LTR and RTL", () => {
  assert.equal(semanticDirectionFromPhysical("left", "ltr"), "inline-start");
  assert.equal(semanticDirectionFromPhysical("right", "ltr"), "inline-end");
  assert.equal(semanticDirectionFromPhysical("left", "rtl"), "inline-end");
  assert.equal(semanticDirectionFromPhysical("right", "rtl"), "inline-start");
});

test("Phase 2 placement is inverted into the direction ORBY should point", () => {
  assert.equal(directionFromPlacement("top", "rtl"), "down");
  assert.equal(directionFromPlacement("bottom", "rtl"), "up");
  assert.equal(directionFromPlacement("right", "rtl"), "inline-end");
  assert.equal(directionFromPlacement("left", "rtl"), "inline-start");
  assert.equal(directionFromPlacement("center", "rtl"), "target");
});

test("explicit Phase 1 direction remains backward compatible while target uses Phase 2 placement", () => {
  assert.equal(resolveGuideDirection("up", "left", "rtl"), "up");
  assert.equal(resolveGuideDirection("left", "right", "rtl"), "inline-end");
  assert.equal(resolveGuideDirection("target", "right", "rtl"), "inline-end");
});

test("missing, hidden, detached or pending targets never produce a point into empty space", () => {
  for (const targetState of ["pending", "missing", "hidden", "detached", "unavailable"] as const) {
    const result = resolveORBYPresentationRequest({
      guideIntent: "point",
      guideDirection: "target",
      placement: "right",
      pageDirection: "rtl",
      targetState,
      reducedMotion: false,
    });
    assert.deepEqual(result, { intent: "waiting", direction: "neutral", layoutDirection: "rtl" });
  }
});

test("resolved requests carry layout direction into the future animation driver boundary", () => {
  const result = resolveORBYPresentationRequest({
    guideIntent: "point",
    guideDirection: "target",
    placement: "right",
    pageDirection: "ltr",
    targetState: "resolved",
    reducedMotion: false,
  });
  assert.equal(result.layoutDirection, "ltr");
  assert.equal(result.direction, "inline-start");
});

test("resolved point intent uses look then point instead of snapping directly", () => {
  const plan = createORBYMotionPlan({ intent: "point", direction: "inline-start", reducedMotion: false });
  assert.deepEqual(plan.map(({ intent }) => intent), ["look", "point"]);
  assert.ok(plan[1].delayMs > plan[0].delayMs);
});

test("reduced motion keeps the semantic point as a still pose without flourish", () => {
  const plan = createORBYMotionPlan({ intent: "point", direction: "inline-start", reducedMotion: true });
  assert.deepEqual(plan, [{ delayMs: 0, intent: "point", direction: "inline-start" }]);
});

test("rapid step changes cancel stale look/point stages", async () => {
  const manual = manualScheduler();
  const runtime = new ORBYCharacterRuntime({ scheduler: manual.scheduler });
  await runtime.present({ intent: "point", direction: "inline-start", layoutDirection: "rtl", reducedMotion: false });
  assert.equal(runtime.getSnapshot().frame.intent, "enter");
  assert.ok(manual.size() > 0);
  await runtime.present({ intent: "attention", direction: "inline-end", layoutDirection: "rtl", reducedMotion: false });
  manual.flush();
  assert.equal(runtime.getSnapshot().frame.intent, "attention");
  assert.equal(runtime.getSnapshot().frame.direction, "inline-end");
  assert.equal(runtime.getSnapshot().frame.layoutDirection, "rtl");
  runtime.dispose();
});

test("same target semantics do not restart the motion plan on geometry-only movement", async () => {
  const manual = manualScheduler();
  const runtime = new ORBYCharacterRuntime({ scheduler: manual.scheduler });
  await runtime.present({ intent: "attention", direction: "inline-start", layoutDirection: "rtl", reducedMotion: true });
  const first = runtime.getSnapshot().frame.sequence;
  await runtime.present({ intent: "attention", direction: "inline-start", layoutDirection: "rtl", reducedMotion: true });
  assert.equal(runtime.getSnapshot().frame.sequence, first);
  runtime.dispose();
});

test("animation driver is not requested while no guide presentation is active", () => {
  let loads = 0;
  const runtime = new ORBYCharacterRuntime({ driverFactory: async () => {
    loads += 1;
    return { apply() {} };
  } });
  assert.equal(runtime.getSnapshot().driverStatus, "not_requested");
  assert.equal(loads, 0);
  runtime.dispose();
});

test("animation driver failure degrades to static fallback without throwing", async () => {
  const runtime = new ORBYCharacterRuntime({ driverFactory: async () => { throw new Error("rig unavailable"); } });
  await runtime.present({ intent: "idle", direction: "neutral", layoutDirection: "rtl", reducedMotion: true });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(runtime.getSnapshot().driverStatus, "fallback");
  assert.equal(runtime.getSnapshot().frame.intent, "idle");
  runtime.dispose();
});

test("completion is the only terminal path allowed to celebrate", async () => {
  const completeScheduler = manualScheduler();
  const complete = new ORBYCharacterRuntime({ scheduler: completeScheduler.scheduler });
  await complete.present({ intent: "idle", direction: "neutral", layoutDirection: "rtl", reducedMotion: true });
  complete.exit({ reason: "complete", reducedMotion: false });
  assert.equal(complete.getSnapshot().frame.intent, "celebrate");
  completeScheduler.flush();
  assert.equal(complete.getSnapshot().frame.intent, "exit");

  const dismissed = new ORBYCharacterRuntime();
  await dismissed.present({ intent: "idle", direction: "neutral", layoutDirection: "rtl", reducedMotion: true });
  dismissed.exit({ reason: "dismiss", reducedMotion: false });
  assert.equal(dismissed.getSnapshot().frame.intent, "exit");

  const skipped = new ORBYCharacterRuntime();
  await skipped.present({ intent: "idle", direction: "neutral", layoutDirection: "rtl", reducedMotion: true });
  skipped.exit({ reason: "skip", reducedMotion: false });
  assert.equal(skipped.getSnapshot().frame.intent, "exit");
  complete.dispose(); dismissed.dispose(); skipped.dispose();
});

test("Phase 3 fixture is Arabic-first and covers reusable semantic states only", () => {
  const steps = phase3OrbyPresentationFixture.journeys[0].steps;
  assert.equal(steps.length, 6);
  assert.deepEqual(steps.map((step) => step.character?.intent), ["idle", "attention", "point", "point", "confirm", "celebrate"]);
  assert.ok(steps.every((step) => step.content.message.defaultLocale === "ar"));
});

test("authoritative ORBY source is present and honestly classified as flat raster wrapped by SVG", () => {
  const asset = readFileSync("public/brand/orby-assistant.svg", "utf8");
  assert.match(asset, /viewBox="0 0 256 256"/);
  assert.match(asset, /<image\b/);
  assert.match(asset, /data:image\/webp;base64,/);
});

test("Phase 3 does not add a fake Rive dependency or a fabricated rig file", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string> };
  assert.equal(Object.keys(pkg.dependencies ?? {}).some((name) => /rive|lottie/i.test(name)), false);
  const presentation = readFileSync("components/guided-learning/ORBYGuidePresentation.tsx", "utf8");
  assert.match(presentation, /\/brand\/orby-assistant\.svg/);
});

test("Guided Learning Host keeps Phase 2 placement as the single positioning source", () => {
  const host = readFileSync("components/guided-learning/GuidedLearningHost.tsx", "utf8");
  assert.match(host, /computeGuidePlacement\(/);
  assert.match(host, /resolveORBYPresentationRequest/);
  const characterAdapter = readFileSync("src/lib/guided-learning/character/intent-adapter.ts", "utf8");
  assert.doesNotMatch(characterAdapter, /querySelector|getBoundingClientRect|document\.|window\./);
});

test("production boundary does not register the Phase 3 fixture or load a guide when idle", () => {
  const boundary = readFileSync("components/guided-learning/GuidedLearningBoundary.tsx", "utf8");
  assert.doesNotMatch(boundary, /phase3OrbyPresentationFixture|registerGuide\(/);
  const host = readFileSync("components/guided-learning/GuidedLearningHost.tsx", "utf8");
  assert.match(host, /if \(!clientReady \|\| !active \|\| !guide \|\| !step\) return null/);
});
