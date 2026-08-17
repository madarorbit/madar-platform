import { GUIDE_PRIORITY, type GuideDefinition } from "../contracts";
import { defineGuideId, defineGuideStepId, defineGuideTargetId, defineJourneyId } from "../validation";

const ar = (defaultText: string) => ({ defaultLocale: "ar" as const, defaultText });

/** Test/dev fixture only. Production application code must never register this guide. */
export const phase2EngineFixture: GuideDefinition = {
  id: defineGuideId("phase-2-engine-fixture"),
  version: 1,
  revision: 1,
  type: "manual_tour",
  scope: { type: "account" },
  trigger: { type: "explicit_user_request" },
  priority: GUIDE_PRIORITY.manual,
  journeys: [{
    id: defineJourneyId("engine-path"),
    steps: [
      { id: defineGuideStepId("button-target"), kind: "explanation", target: { id: defineGuideTargetId("phase2.fixture.button") }, content: { message: ar("هدف مرئي لاختبار الـSpotlight.") }, placementHint: "auto", interaction: { mode: "manual_next" }, skippable: true },
      { id: defineGuideStepId("offscreen-target"), kind: "interaction", target: { id: defineGuideTargetId("phase2.fixture.offscreen") }, content: { message: ar("هدف خارج الشاشة لاختبار الانتقال والتمرير.") }, placementHint: "start", interaction: { mode: "user_action", actionId: "phase2-fixture-action" }, skippable: true },
      { id: defineGuideStepId("dynamic-target"), kind: "explanation", target: { id: defineGuideTargetId("phase2.fixture.dynamic"), optional: true }, content: { message: ar("هدف ديناميكي لاختبار تغير الحجم أو الاختفاء.") }, placementHint: "end", interaction: { mode: "manual_next" }, skippable: true },
    ],
  }],
  defaultJourneyId: defineJourneyId("engine-path"),
  completion: { mode: "last_step", allowSkip: true, allowDismiss: true },
  replay: { allowed: true, preserveCompletionHistory: true },
  updatePolicy: "preserve_completion",
};
