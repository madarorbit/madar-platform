import { GUIDE_PRIORITY, type GuideDefinition } from "../contracts";
import {
  defineGuideId,
  defineGuideStepId,
  defineGuideTargetId,
  defineJourneyId,
} from "../validation";

const ar = (defaultText: string) => ({ defaultLocale: "ar" as const, defaultText });

/** Phase 1 contract fixture. It is never registered by production application code. */
export const phase1FoundationFixture: GuideDefinition = {
  id: defineGuideId("phase-1-foundation-fixture"),
  version: 1,
  revision: 1,
  type: "manual_tour",
  scope: { type: "account" },
  trigger: { type: "explicit_user_request" },
  priority: GUIDE_PRIORITY.manual,
  journeys: [
    {
      id: defineJourneyId("foundation-path"),
      steps: [
        {
          id: defineGuideStepId("welcome"),
          kind: "informational",
          content: {
            message: ar("مرحبًا، هذه خطوة اختبارية لإثبات أساس نظام الإرشاد."),
          },
          interaction: { mode: "manual_next" },
          character: { intent: "attention" },
          skippable: true,
        },
        {
          id: defineGuideStepId("stable-target"),
          kind: "explanation",
          target: { id: defineGuideTargetId("foundation.shell.example") },
          content: {
            message: ar("هذا هدف ثابت تجريبي لا يعتمد على بنية DOM الهشة."),
          },
          interaction: { mode: "manual_next" },
          character: { intent: "point", direction: "target" },
          skippable: true,
        },
        {
          id: defineGuideStepId("finish"),
          kind: "completion",
          content: {
            message: ar("اكتمل اختبار عقود المرحلة الأولى."),
          },
          interaction: { mode: "manual_next" },
          character: { intent: "confirm" },
        },
      ],
    },
  ],
  defaultJourneyId: defineJourneyId("foundation-path"),
  completion: { mode: "last_step", allowSkip: true, allowDismiss: true },
  replay: { allowed: true, preserveCompletionHistory: true },
  updatePolicy: "preserve_completion",
};
