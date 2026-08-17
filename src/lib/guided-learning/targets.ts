import type { GuideTargetId } from "./contracts";
import { GuidedLearningError } from "./errors";
import { defineGuideTargetId } from "./validation";

export const GUIDE_TARGET_ATTRIBUTE = "data-madar-guide" as const;

export type GuideTargetDefinition = Readonly<{
  id: GuideTargetId;
  description?: string;
}>;

/**
 * Declares stable target identifiers. It does not scan or own the DOM.
 * Phase 2 can resolve mounted elements by GUIDE_TARGET_ATTRIBUTE.
 */
export class GuideTargetRegistry {
  private readonly targets = new Map<GuideTargetId, GuideTargetDefinition>();

  register(definition: GuideTargetDefinition): GuideTargetDefinition {
    defineGuideTargetId(definition.id);
    if (this.targets.has(definition.id)) {
      throw new GuidedLearningError("duplicate_target", `Duplicate guide target: ${definition.id}`);
    }
    this.targets.set(definition.id, definition);
    return definition;
  }

  get(id: GuideTargetId): GuideTargetDefinition | undefined {
    return this.targets.get(id);
  }

  list(): readonly GuideTargetDefinition[] {
    return [...this.targets.values()];
  }
}

export function guideTargetProps(id: GuideTargetId): Readonly<Record<typeof GUIDE_TARGET_ATTRIBUTE, string>> {
  defineGuideTargetId(id);
  return { [GUIDE_TARGET_ATTRIBUTE]: id };
}
