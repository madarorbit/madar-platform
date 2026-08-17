import assert from "node:assert/strict";
import test from "node:test";
import {
  GUIDE_PRIORITY,
  GuideRegistry,
  GuideTargetRegistry,
  GuidedLearningError,
  GuidedLearningRuntime,
  MemoryLearningProgressStore,
  defineGuideId,
  defineGuideStepId,
  defineGuideTargetId,
  defineJourneyId,
  guideTargetProps,
  selectHighestPriority,
  validateGuideDefinition,
  type GuideDefinition,
  type LearningProgressSubject,
} from "../src/lib/guided-learning/index.ts";
import { phase1FoundationFixture } from "../src/lib/guided-learning/testing/phase-1-foundation-fixture.ts";

const subject: LearningProgressSubject = { accountId: "account-test-1" };
const fixtureId = phase1FoundationFixture.id;

const cloneFixture = (overrides: Partial<GuideDefinition> = {}): GuideDefinition => ({
  ...phase1FoundationFixture,
  ...overrides,
});

const runtimeFor = () => {
  const registry = new GuideRegistry();
  registry.register(phase1FoundationFixture);
  const store = new MemoryLearningProgressStore();
  let tick = 0;
  const runtime = new GuidedLearningRuntime({
    registry,
    progressStore: store,
    now: () => new Date(Date.UTC(2026, 7, 18, 0, 0, tick++)),
  });
  return { registry, store, runtime };
};

test("registry registers and resolves a typed guide", () => {
  const registry = new GuideRegistry();
  registry.register(phase1FoundationFixture);
  assert.equal(registry.getGuide(fixtureId), phase1FoundationFixture);
  assert.equal(registry.list({ scope: "account" }).length, 1);
});

test("registry rejects duplicate IDs and reports unknown guides clearly", () => {
  const registry = new GuideRegistry();
  registry.register(phase1FoundationFixture);
  assert.throws(
    () => registry.register(phase1FoundationFixture),
    (error) => error instanceof GuidedLearningError && error.code === "duplicate_guide",
  );
  assert.throws(
    () => registry.getGuide(defineGuideId("unknown-guide")),
    (error) => error instanceof GuidedLearningError && error.code === "guide_not_found",
  );
});

test("definition validation rejects invalid versions, empty journeys and duplicate steps", () => {
  assert.throws(
    () => validateGuideDefinition(cloneFixture({ version: 0 })),
    (error) => error instanceof GuidedLearningError && error.code === "invalid_definition",
  );
  assert.throws(
    () => validateGuideDefinition(cloneFixture({ journeys: [] })),
    (error) => error instanceof GuidedLearningError && error.code === "invalid_definition",
  );

  const duplicatedStep = phase1FoundationFixture.journeys[0].steps[0];
  const journey = {
    ...phase1FoundationFixture.journeys[0],
    steps: [duplicatedStep, duplicatedStep],
  };
  assert.throws(
    () => validateGuideDefinition(cloneFixture({ journeys: [journey] })),
    (error) => error instanceof GuidedLearningError && error.code === "invalid_step",
  );
});

test("lifecycle progresses start -> active -> next -> completed", async () => {
  const { runtime, store } = runtimeFor();
  const started = await runtime.startGuide(fixtureId, { subject });
  assert.equal(started.phase, "active");
  assert.equal(started.stepIndex, 0);

  const second = await runtime.nextStep(subject);
  assert.equal(second.phase, "active");
  assert.equal(second.stepIndex, 1);
  const third = await runtime.nextStep(subject);
  assert.equal(third.phase, "active");
  assert.equal(third.stepIndex, 2);
  const completed = await runtime.nextStep(subject);
  assert.equal(completed.phase, "completed");

  const progress = await store.getProgress(subject, fixtureId);
  assert.equal(progress?.status, "completed");
  assert.equal(progress?.completionHistory.length, 1);
});

test("active guide can be skipped without becoming completed", async () => {
  const { runtime, store } = runtimeFor();
  await runtime.startGuide(fixtureId, { subject });
  assert.equal((await runtime.skipGuide(subject)).phase, "skipped");
  const progress = await store.getProgress(subject, fixtureId);
  assert.equal(progress?.status, "skipped");
  assert.equal(progress?.completionHistory.length, 0);
  assert.ok(progress?.skippedAt);
});

test("active contextual-style guide can be dismissed distinctly from skip", async () => {
  const { runtime, store } = runtimeFor();
  await runtime.startGuide(fixtureId, { subject });
  assert.equal((await runtime.dismissGuide(subject)).phase, "dismissed");
  const progress = await store.getProgress(subject, fixtureId);
  assert.equal(progress?.status, "dismissed");
  assert.ok(progress?.dismissedAt);
  assert.equal(progress?.skippedAt, undefined);
});

test("pause and resume preserve the active foreground step", async () => {
  const { runtime, store } = runtimeFor();
  await runtime.startGuide(fixtureId, { subject });
  await runtime.nextStep(subject);
  const paused = await runtime.pauseGuide(subject);
  assert.equal(paused.phase, "paused");
  assert.equal(paused.stepIndex, 1);
  assert.equal((await store.getProgress(subject, fixtureId))?.status, "in_progress");

  const resumed = await runtime.resumeGuide();
  assert.equal(resumed.phase, "active");
  assert.equal(resumed.stepIndex, 1);
});

test("in-progress state restores the correct step after runtime recreation", async () => {
  const { registry, store, runtime } = runtimeFor();
  await runtime.startGuide(fixtureId, { subject });
  await runtime.nextStep(subject);

  const recreated = new GuidedLearningRuntime({ registry, progressStore: store });
  const restored = await recreated.restoreGuide(fixtureId, subject);
  assert.equal(restored.phase, "active");
  assert.equal(restored.stepIndex, 1);
});

test("manual replay preserves historical completion records", async () => {
  const { runtime, store } = runtimeFor();
  await runtime.startGuide(fixtureId, { subject });
  await runtime.nextStep(subject);
  await runtime.nextStep(subject);
  await runtime.nextStep(subject);
  const baseline = await store.getProgress(subject, fixtureId);
  assert.equal(baseline?.completionHistory.length, 1);
  assert.equal(baseline?.completionHistory[0].mode, "standard");

  runtime.clearTerminalState();
  await runtime.startGuide(fixtureId, { subject, mode: "replay" });
  const duringReplay = await store.getProgress(subject, fixtureId);
  assert.equal(duringReplay?.status, "in_progress");
  assert.equal(duringReplay?.completionHistory.length, 1);

  await runtime.nextStep(subject);
  await runtime.nextStep(subject);
  await runtime.nextStep(subject);
  const afterReplay = await store.getProgress(subject, fixtureId);
  assert.equal(afterReplay?.completionHistory.length, 2);
  assert.deepEqual(afterReplay?.completionHistory.map((record) => record.mode), ["standard", "replay"]);
});

test("priority selection is deterministic and ties break by guide id", () => {
  const platform = cloneFixture({
    id: defineGuideId("platform-priority-fixture"),
    type: "platform_onboarding",
    priority: GUIDE_PRIORITY.platformOnboarding,
  });
  const service = cloneFixture({
    id: defineGuideId("service-priority-fixture"),
    type: "service_onboarding",
    priority: GUIDE_PRIORITY.serviceOnboarding,
  });
  assert.equal(selectHighestPriority([platform, service])?.id, service.id);

  const alpha = cloneFixture({ id: defineGuideId("alpha-fixture"), priority: 200 });
  const beta = cloneFixture({ id: defineGuideId("beta-fixture"), priority: 200 });
  assert.equal(selectHighestPriority([beta, alpha])?.id, alpha.id);
});

test("only one foreground guide can own the runtime", async () => {
  const { registry, runtime } = runtimeFor();
  const second = cloneFixture({ id: defineGuideId("second-fixture") });
  registry.register(second);
  await runtime.startGuide(fixtureId, { subject });
  await assert.rejects(
    () => runtime.startGuide(second.id, { subject }),
    (error) => error instanceof GuidedLearningError && error.code === "guide_conflict",
  );
});

test("memory progress store has no browser-storage dependency", async () => {
  const store = new MemoryLearningProgressStore();
  assert.equal(await store.getProgress(subject, fixtureId), null);
  await store.saveProgress(subject, {
    guideId: fixtureId,
    guideVersion: 1,
    status: "not_started",
    completionHistory: [],
  });
  assert.equal((await store.getProgress(subject, fixtureId))?.status, "not_started");
  await store.resetProgress(subject, fixtureId);
  assert.equal(await store.getProgress(subject, fixtureId), null);
});

test("stable target IDs enforce naming and reject duplicates", () => {
  const id = defineGuideTargetId("global.navigation.notifications");
  assert.deepEqual(guideTargetProps(id), { "data-madar-guide": id });
  assert.throws(
    () => defineGuideTargetId("div > button:nth-child(3)"),
    (error) => error instanceof GuidedLearningError && error.code === "invalid_target",
  );

  const registry = new GuideTargetRegistry();
  registry.register({ id });
  assert.throws(
    () => registry.register({ id }),
    (error) => error instanceof GuidedLearningError && error.code === "duplicate_target",
  );
});

test("navigation and user-action step contracts are representable without UI code", () => {
  const definition = cloneFixture({
    id: defineGuideId("interaction-contract-fixture"),
    journeys: [
      {
        id: defineJourneyId("interaction-path"),
        steps: [
          {
            id: defineGuideStepId("navigate"),
            kind: "navigation",
            content: { message: { defaultLocale: "ar", defaultText: "انتقل إلى صفحة ORBY." } },
            route: { pathname: "/orby" },
            interaction: { mode: "navigation", expectedRoute: "/orby" },
          },
          {
            id: defineGuideStepId("act"),
            kind: "interaction",
            content: { message: { defaultLocale: "ar", defaultText: "نفّذ الإجراء المطلوب." } },
            interaction: { mode: "user_action", actionId: "fixture-action" },
          },
        ],
      },
    ],
    defaultJourneyId: defineJourneyId("interaction-path"),
  });
  assert.equal(validateGuideDefinition(definition), definition);
});
