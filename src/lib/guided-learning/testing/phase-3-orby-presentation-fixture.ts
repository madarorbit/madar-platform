import { GUIDE_PRIORITY, type GuideDefinition } from "../contracts";
import { defineGuideId, defineGuideStepId, defineGuideTargetId, defineJourneyId } from "../validation";

const ar = (defaultText: string) => ({ defaultLocale: "ar" as const, defaultText });

/** Test/dev fixture only. Never register this guide in production. */
export const phase3OrbyPresentationFixture: GuideDefinition = {
  id: defineGuideId("phase-3-orby-presentation-fixture"),
  version: 1,
  revision: 1,
  type: "manual_tour",
  scope: { type: "account" },
  trigger: { type: "explicit_user_request" },
  priority: GUIDE_PRIORITY.manual,
  journeys: [{
    id: defineJourneyId("orby-presentation-path"),
    steps: [
      { id: defineGuideStepId("orby-idle"), kind: "informational", content: { message: ar("أنا معك. خلّنا نبدأ بهدوء.") }, character: { intent: "idle" }, placementHint: "center", interaction: { mode: "manual_next" } },
      { id: defineGuideStepId("orby-attention"), kind: "region", target: { id: defineGuideTargetId("phase3.fixture.attention") }, content: { message: ar("انتبه لهذه المنطقة.") }, character: { intent: "attention", direction: "target" }, placementHint: "auto", interaction: { mode: "manual_next" } },
      { id: defineGuideStepId("orby-point-start"), kind: "explanation", target: { id: defineGuideTargetId("phase3.fixture.start") }, content: { message: ar("من هنا تقدر تبدأ.") }, character: { intent: "point", direction: "target" }, placementHint: "end", interaction: { mode: "manual_next" } },
      { id: defineGuideStepId("orby-point-end"), kind: "interaction", target: { id: defineGuideTargetId("phase3.fixture.end") }, content: { message: ar("اضغط هنا، وبوريك الخطوة التالية.") }, character: { intent: "point", direction: "target" }, placementHint: "start", interaction: { mode: "user_action", actionId: "phase3-fixture-action" } },
      { id: defineGuideStepId("orby-confirm"), kind: "explanation", target: { id: defineGuideTargetId("phase3.fixture.confirm") }, content: { message: ar("تمام، كذا صح.") }, character: { intent: "confirm" }, placementHint: "auto", interaction: { mode: "manual_next" } },
      { id: defineGuideStepId("orby-celebrate"), kind: "completion", content: { message: ar("خلصنا الجولة.") }, character: { intent: "celebrate" }, placementHint: "center", interaction: { mode: "manual_next" } },
    ],
  }],
  defaultJourneyId: defineJourneyId("orby-presentation-path"),
  completion: { mode: "last_step", allowSkip: true, allowDismiss: true },
  replay: { allowed: true, preserveCompletionHistory: true },
  updatePolicy: "preserve_completion",
};
