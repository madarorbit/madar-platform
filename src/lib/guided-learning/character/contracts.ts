import type { GuideCharacterDirection, GuideCharacterIntent } from "../contracts";
import type { GuidePhysicalPlacement, GuideTargetResolutionState } from "../browser/engine";

export const ORBY_MOTION_INTENTS = [
  "idle",
  "enter",
  "exit",
  "look",
  "point",
  "attention",
  "confirm",
  "celebrate",
  "thinking",
  "waiting",
] as const;

export type ORBYMotionIntent = (typeof ORBY_MOTION_INTENTS)[number];

export const ORBY_MOTION_DIRECTIONS = [
  "neutral",
  "up",
  "down",
  "inline-start",
  "inline-end",
  "target",
] as const;

export type ORBYMotionDirection = (typeof ORBY_MOTION_DIRECTIONS)[number];
export type ORBYMotionMode = "animated" | "still";

export type ORBYMotionFrame = Readonly<{
  sequence: number;
  intent: ORBYMotionIntent;
  direction: ORBYMotionDirection;
  mode: ORBYMotionMode;
  active: boolean;
}>;

export type ORBYCharacterPresentationRequest = Readonly<{
  guideIntent?: GuideCharacterIntent;
  guideDirection?: GuideCharacterDirection;
  placement: GuidePhysicalPlacement;
  pageDirection: "rtl" | "ltr";
  targetState: GuideTargetResolutionState;
  reducedMotion: boolean;
}>;

export type ORBYMotionStage = Readonly<{
  delayMs: number;
  intent: ORBYMotionIntent;
  direction: ORBYMotionDirection;
}>;

/**
 * Animation-technology boundary. Guide definitions and the Phase 1 runtime never
 * know Rive/Lottie/state-machine implementation details.
 */
export interface ORBYCharacterDriver {
  apply(frame: ORBYMotionFrame): void;
  setDocumentVisible?(visible: boolean): void;
  dispose?(): void;
}

export type ORBYCharacterDriverFactory = () => Promise<ORBYCharacterDriver>;
