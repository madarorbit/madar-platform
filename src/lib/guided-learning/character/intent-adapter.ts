import type { GuideCharacterDirection, GuideCharacterIntent } from "../contracts";
import type { GuidePhysicalPlacement } from "../browser/engine";
import type {
  ORBYCharacterPresentationRequest,
  ORBYLayoutDirection,
  ORBYMotionDirection,
  ORBYMotionIntent,
  ORBYMotionStage,
} from "./contracts";

const BUILT_IN_INTENTS = new Set<GuideCharacterIntent>([
  "idle",
  "point",
  "attention",
  "confirm",
  "celebrate",
  "thinking",
]);

export function mapGuideIntentToORBY(intent?: GuideCharacterIntent): ORBYMotionIntent {
  if (!intent || !BUILT_IN_INTENTS.has(intent)) return "idle";
  return intent as ORBYMotionIntent;
}

export function semanticDirectionFromPhysical(
  physical: "left" | "right",
  pageDirection: ORBYLayoutDirection,
): ORBYMotionDirection {
  if (physical === "left") return pageDirection === "rtl" ? "inline-end" : "inline-start";
  return pageDirection === "rtl" ? "inline-start" : "inline-end";
}

export function directionFromPlacement(
  placement: GuidePhysicalPlacement,
  pageDirection: ORBYLayoutDirection,
): ORBYMotionDirection {
  // Placement describes where the presentation sits relative to the target;
  // pointing direction is therefore the inverse physical direction.
  if (placement === "top") return "down";
  if (placement === "bottom") return "up";
  if (placement === "left") return semanticDirectionFromPhysical("right", pageDirection);
  if (placement === "right") return semanticDirectionFromPhysical("left", pageDirection);
  return "target";
}

export function resolveGuideDirection(
  requested: GuideCharacterDirection | undefined,
  placement: GuidePhysicalPlacement,
  pageDirection: ORBYLayoutDirection,
): ORBYMotionDirection {
  if (!requested || requested === "target") return directionFromPlacement(placement, pageDirection);
  if (requested === "left" || requested === "right") return semanticDirectionFromPhysical(requested, pageDirection);
  return requested;
}

export function resolveORBYPresentationRequest(
  request: ORBYCharacterPresentationRequest,
): Readonly<{ intent: ORBYMotionIntent; direction: ORBYMotionDirection; layoutDirection: ORBYLayoutDirection }> {
  if (request.targetState === "pending") return { intent: "waiting", direction: "neutral", layoutDirection: request.pageDirection };
  if (request.targetState !== "resolved") return { intent: "waiting", direction: "neutral", layoutDirection: request.pageDirection };
  const intent = mapGuideIntentToORBY(request.guideIntent);
  return {
    intent,
    direction: resolveGuideDirection(request.guideDirection, request.placement, request.pageDirection),
    layoutDirection: request.pageDirection,
  };
}

export function createORBYMotionPlan(input: Readonly<{
  intent: ORBYMotionIntent;
  direction: ORBYMotionDirection;
  reducedMotion: boolean;
}>): readonly ORBYMotionStage[] {
  if (input.reducedMotion) {
    return [{ delayMs: 0, intent: input.intent, direction: input.direction }];
  }

  if (input.intent === "point") {
    return [
      { delayMs: 0, intent: "look", direction: input.direction },
      { delayMs: 110, intent: "point", direction: input.direction },
    ];
  }

  return [{ delayMs: 0, intent: input.intent, direction: input.direction }];
}
