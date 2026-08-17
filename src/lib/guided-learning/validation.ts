import type {
  GuideDefinition,
  GuideId,
  GuideStep,
  GuideStepId,
  GuideTargetId,
  JourneyId,
} from "./contracts";
import { GuidedLearningError } from "./errors";

const GUIDE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const STEP_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const TARGET_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;

const assertNonEmptyArabicText = (step: GuideStep) => {
  if (
    step.content.message.defaultLocale !== "ar" ||
    step.content.message.defaultText.trim().length === 0
  ) {
    throw new GuidedLearningError(
      "invalid_step",
      `Step ${step.id} must provide a non-empty Arabic-first message.`,
      { stepId: step.id },
    );
  }
};

export function defineGuideId(value: string): GuideId {
  if (!GUIDE_ID_PATTERN.test(value)) {
    throw new GuidedLearningError("invalid_definition", `Invalid guide id: ${value}`);
  }
  return value as GuideId;
}

export function defineJourneyId(value: string): JourneyId {
  if (!STEP_ID_PATTERN.test(value)) {
    throw new GuidedLearningError("invalid_definition", `Invalid journey id: ${value}`);
  }
  return value as JourneyId;
}

export function defineGuideStepId(value: string): GuideStepId {
  if (!STEP_ID_PATTERN.test(value)) {
    throw new GuidedLearningError("invalid_step", `Invalid step id: ${value}`);
  }
  return value as GuideStepId;
}

export function defineGuideTargetId(value: string): GuideTargetId {
  if (!TARGET_ID_PATTERN.test(value)) {
    throw new GuidedLearningError(
      "invalid_target",
      `Invalid guide target id: ${value}. Use lowercase hierarchical IDs such as domain.area.element.`,
    );
  }
  return value as GuideTargetId;
}

export function validateGuideDefinition(definition: GuideDefinition): GuideDefinition {
  defineGuideId(definition.id);
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new GuidedLearningError("invalid_definition", "Guide version must be a positive integer.", {
      guideId: definition.id,
    });
  }
  if (!Number.isInteger(definition.revision) || definition.revision < 1) {
    throw new GuidedLearningError("invalid_definition", "Guide revision must be a positive integer.", {
      guideId: definition.id,
    });
  }
  if (!Number.isFinite(definition.priority ?? 0)) {
    throw new GuidedLearningError("invalid_definition", "Guide priority must be finite.", {
      guideId: definition.id,
    });
  }
  if (definition.journeys.length === 0) {
    throw new GuidedLearningError("invalid_definition", "Guide must contain at least one journey.", {
      guideId: definition.id,
    });
  }

  const journeyIds = new Set<string>();
  let defaultJourneyFound = false;
  for (const journey of definition.journeys) {
    defineJourneyId(journey.id);
    if (journeyIds.has(journey.id)) {
      throw new GuidedLearningError("invalid_definition", `Duplicate journey id: ${journey.id}`, {
        guideId: definition.id,
      });
    }
    journeyIds.add(journey.id);
    if (journey.id === definition.defaultJourneyId) defaultJourneyFound = true;
    if (journey.steps.length === 0) {
      throw new GuidedLearningError("invalid_definition", `Journey ${journey.id} must contain steps.`, {
        guideId: definition.id,
      });
    }

    const stepIds = new Set<string>();
    for (const step of journey.steps) {
      defineGuideStepId(step.id);
      if (stepIds.has(step.id)) {
        throw new GuidedLearningError("invalid_step", `Duplicate step id: ${step.id}`, {
          guideId: definition.id,
          stepId: step.id,
        });
      }
      stepIds.add(step.id);
      assertNonEmptyArabicText(step);
      if (step.target) defineGuideTargetId(step.target.id);
      if (step.route && !step.route.pathname.startsWith("/")) {
        throw new GuidedLearningError("invalid_route", `Invalid route: ${step.route.pathname}`, {
          guideId: definition.id,
          stepId: step.id,
        });
      }
      if (step.interaction.mode === "navigation" && !step.route && !step.interaction.expectedRoute) {
        throw new GuidedLearningError(
          "invalid_step",
          `Navigation step ${step.id} needs a route or expectedRoute.`,
          { guideId: definition.id, stepId: step.id },
        );
      }
    }
  }

  if (!defaultJourneyFound) {
    throw new GuidedLearningError(
      "invalid_definition",
      `Default journey ${definition.defaultJourneyId} is not registered in guide ${definition.id}.`,
      { guideId: definition.id },
    );
  }

  return definition;
}
