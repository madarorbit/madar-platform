import {
  GUIDE_PRIORITY,
  type GuideDefinition,
  type GuideId,
  type GuideScopeType,
  type GuideType,
} from "./contracts";
import { GuidedLearningError } from "./errors";
import { validateGuideDefinition } from "./validation";

const DEFAULT_PRIORITY_BY_TYPE: Record<string, number> = {
  service_onboarding: GUIDE_PRIORITY.serviceOnboarding,
  platform_onboarding: GUIDE_PRIORITY.platformOnboarding,
  page_guidance: GUIDE_PRIORITY.pageGuidance,
  feature_discovery: GUIDE_PRIORITY.featureDiscovery,
  contextual_tip: GUIDE_PRIORITY.contextualTip,
  interactive_action: GUIDE_PRIORITY.pageGuidance,
  manual_tour: GUIDE_PRIORITY.manual,
};

export type GuideRegistryFilter = Readonly<{
  type?: GuideType;
  scope?: GuideScopeType;
  pathname?: string;
  serviceKey?: string;
  featureKey?: string;
}>;

export function guidePriority(definition: GuideDefinition): number {
  return definition.priority ?? DEFAULT_PRIORITY_BY_TYPE[definition.type] ?? GUIDE_PRIORITY.contextualTip;
}

export function selectHighestPriority(guides: readonly GuideDefinition[]): GuideDefinition | null {
  return [...guides].sort((a, b) => {
    const priorityDifference = guidePriority(b) - guidePriority(a);
    if (priorityDifference !== 0) return priorityDifference;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}

export class GuideRegistry {
  private readonly definitions = new Map<GuideId, GuideDefinition>();

  register(definition: GuideDefinition): GuideDefinition {
    validateGuideDefinition(definition);
    if (this.definitions.has(definition.id)) {
      throw new GuidedLearningError("duplicate_guide", `Guide already registered: ${definition.id}`, {
        guideId: definition.id,
      });
    }
    this.definitions.set(definition.id, definition);
    return definition;
  }

  getGuide(id: GuideId): GuideDefinition {
    const definition = this.definitions.get(id);
    if (!definition) {
      throw new GuidedLearningError("guide_not_found", `Guide not found: ${id}`, { guideId: id });
    }
    return definition;
  }

  tryGetGuide(id: GuideId): GuideDefinition | null {
    return this.definitions.get(id) ?? null;
  }

  list(filter: GuideRegistryFilter = {}): readonly GuideDefinition[] {
    return [...this.definitions.values()].filter((definition) => {
      if (filter.type && definition.type !== filter.type) return false;
      if (filter.scope && definition.scope.type !== filter.scope) return false;
      if (filter.pathname) {
        const pathname =
          definition.scope.type === "page"
            ? definition.scope.pathname
            : definition.trigger.type === "first_page_visit"
              ? definition.trigger.pathname
              : undefined;
        if (pathname !== filter.pathname) return false;
      }
      if (filter.serviceKey) {
        const serviceKey =
          definition.scope.type === "service" || definition.scope.type === "workspace"
            ? definition.scope.serviceKey
            : definition.trigger.type === "first_service_access"
              ? definition.trigger.serviceKey
              : undefined;
        if (serviceKey !== filter.serviceKey) return false;
      }
      if (filter.featureKey) {
        const featureKey =
          definition.scope.type === "feature"
            ? definition.scope.featureKey
            : definition.trigger.type === "feature_introduced"
              ? definition.trigger.featureKey
              : undefined;
        if (featureKey !== filter.featureKey) return false;
      }
      return true;
    });
  }

  selectForeground(candidates: readonly GuideDefinition[]): GuideDefinition | null {
    return selectHighestPriority(candidates);
  }
}
