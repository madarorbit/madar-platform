import type { GuideId, GuideStepId, GuidedLearningErrorCode } from "./contracts";

export class GuidedLearningError extends Error {
  readonly code: GuidedLearningErrorCode;
  readonly guideId?: GuideId;
  readonly stepId?: GuideStepId;

  constructor(
    code: GuidedLearningErrorCode,
    message: string,
    details: { guideId?: GuideId; stepId?: GuideStepId; cause?: unknown } = {},
  ) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = "GuidedLearningError";
    this.code = code;
    this.guideId = details.guideId;
    this.stepId = details.stepId;
  }
}
