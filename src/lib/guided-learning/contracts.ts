export const GUIDE_TYPES = [
  "platform_onboarding",
  "service_onboarding",
  "page_guidance",
  "feature_discovery",
  "contextual_tip",
  "interactive_action",
  "manual_tour",
] as const;

export type BuiltInGuideType = (typeof GUIDE_TYPES)[number];
export type GuideType = BuiltInGuideType | `custom:${string}`;

export const GUIDE_SCOPE_TYPES = [
  "platform",
  "account",
  "orby",
  "service",
  "workspace",
  "page",
  "feature",
] as const;

export type GuideScopeType = (typeof GUIDE_SCOPE_TYPES)[number];

export const GUIDE_PROGRESS_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "skipped",
  "dismissed",
] as const;

export type GuideProgressStatus = (typeof GUIDE_PROGRESS_STATUSES)[number];

export const GUIDE_RUNTIME_PHASES = [
  "idle",
  "eligible",
  "starting",
  "active",
  "paused",
  "completed",
  "skipped",
  "dismissed",
  "failed",
] as const;

export type GuideRuntimePhase = (typeof GUIDE_RUNTIME_PHASES)[number];

export const GUIDE_STEP_KINDS = [
  "explanation",
  "region",
  "interaction",
  "navigation",
  "informational",
  "completion",
] as const;

export type GuideStepKind = (typeof GUIDE_STEP_KINDS)[number];

export const GUIDE_INTERACTION_MODES = [
  "passive",
  "manual_next",
  "user_action",
  "navigation",
  "automatic",
] as const;

export type GuideInteractionMode = (typeof GUIDE_INTERACTION_MODES)[number];

export const GUIDE_CHARACTER_INTENTS = [
  "idle",
  "point",
  "attention",
  "confirm",
  "celebrate",
  "thinking",
] as const;

export type BuiltInCharacterIntent = (typeof GUIDE_CHARACTER_INTENTS)[number];
export type GuideCharacterIntent = BuiltInCharacterIntent | `custom:${string}`;

export const GUIDE_CHARACTER_DIRECTIONS = ["up", "down", "left", "right", "target"] as const;
export type GuideCharacterDirection = (typeof GUIDE_CHARACTER_DIRECTIONS)[number];

export const GUIDE_PRIORITY = {
  criticalContextual: 500,
  serviceOnboarding: 400,
  platformOnboarding: 300,
  pageGuidance: 250,
  featureDiscovery: 200,
  contextualTip: 100,
  manual: 50,
} as const;

export type GuideRunMode = "standard" | "replay";
export type GuideUpdatePolicy =
  | "preserve_completion"
  | "full_replay"
  | "new_steps_only"
  | "optional_update";

export type GuideId = string & { readonly __guideId: unique symbol };
export type JourneyId = string & { readonly __journeyId: unique symbol };
export type GuideStepId = string & { readonly __guideStepId: unique symbol };
export type GuideTargetId = string & { readonly __guideTargetId: unique symbol };

export type GuideText = Readonly<{
  /** Arabic is the authoritative default, not a translated fallback. */
  defaultLocale: "ar";
  defaultText: string;
  /** Optional key consumed by MADAR's presentation/i18n layer later. */
  messageKey?: string;
}>;

export type GuideCta = Readonly<{
  id: string;
  label: GuideText;
  action: "next" | "previous" | "skip" | "dismiss" | "complete" | "custom";
}>;

export type OrbyGuideMessage = Readonly<{
  title?: GuideText;
  message: GuideText;
  hint?: GuideText;
  primaryCta?: GuideCta;
  secondaryCta?: GuideCta;
}>;

export type GuideCharacterRequest = Readonly<{
  intent: GuideCharacterIntent;
  direction?: GuideCharacterDirection;
}>;

export type GuideTargetRef = Readonly<{
  id: GuideTargetId;
  optional?: boolean;
}>;

export type GuideRouteHint = Readonly<{
  pathname: string;
  waitForTarget?: boolean;
}>;

export type GuideStepInteraction = Readonly<{
  mode: GuideInteractionMode;
  actionId?: string;
  expectedRoute?: string;
}>;

export type GuideStep = Readonly<{
  id: GuideStepId;
  kind: GuideStepKind;
  content: OrbyGuideMessage;
  target?: GuideTargetRef;
  route?: GuideRouteHint;
  placementHint?: "top" | "bottom" | "start" | "end" | "center" | "auto";
  character?: GuideCharacterRequest;
  interaction: GuideStepInteraction;
  skippable?: boolean;
}>;

export type GuideJourney = Readonly<{
  id: JourneyId;
  steps: readonly GuideStep[];
}>;

export type GuideScope =
  | Readonly<{ type: "platform" }>
  | Readonly<{ type: "account" }>
  | Readonly<{ type: "orby" }>
  | Readonly<{ type: "service"; serviceKey?: string }>
  | Readonly<{ type: "workspace"; serviceKey?: string }>
  | Readonly<{ type: "page"; pathname: string }>
  | Readonly<{ type: "feature"; featureKey: string }>;

export type GuideTrigger =
  | Readonly<{ type: "first_platform_visit" }>
  | Readonly<{ type: "first_service_access"; serviceKey?: string }>
  | Readonly<{ type: "first_page_visit"; pathname?: string }>
  | Readonly<{ type: "feature_introduced"; featureKey: string }>
  | Readonly<{ type: "manual_replay" }>
  | Readonly<{ type: "explicit_user_request" }>
  | Readonly<{ type: "contextual_condition"; conditionKey: string }>;

export type GuideEligibilityRule =
  | Readonly<{ type: "authenticated" }>
  | Readonly<{ type: "route_matches"; pathname: string }>
  | Readonly<{ type: "service_available"; serviceKey: string }>
  | Readonly<{ type: "permission"; permission: string }>
  | Readonly<{ type: "feature_available"; featureKey: string }>
  | Readonly<{ type: "custom"; key: string }>;

export type GuideDefinition = Readonly<{
  id: GuideId;
  /** Learning version. Only explicit updatePolicy decides what a version change means. */
  version: number;
  /** Content/implementation revision. Changing it never replays learning by itself. */
  revision: number;
  type: GuideType;
  scope: GuideScope;
  trigger: GuideTrigger;
  eligibility?: readonly GuideEligibilityRule[];
  priority?: number;
  journeys: readonly GuideJourney[];
  defaultJourneyId: JourneyId;
  completion: Readonly<{
    mode: "last_step" | "explicit";
    allowSkip: boolean;
    allowDismiss: boolean;
  }>;
  replay: Readonly<{
    allowed: boolean;
    preserveCompletionHistory: true;
  }>;
  updatePolicy: GuideUpdatePolicy;
}>;

export type GuidedLearningContext = Readonly<{
  identity: Readonly<{
    userId: string;
    accountId: string;
    role?: string;
    permissions: readonly string[];
  }>;
  route: Readonly<{ pathname: string }>;
  workspace?: Readonly<{ id: string; serviceKey?: string }> | null;
  service?: Readonly<{ key: string }> | null;
  subscriptionState?: string | null;
  featureAvailability: Readonly<Record<string, boolean>>;
  viewport?: Readonly<{
    formFactor: "mobile" | "tablet" | "desktop";
    direction: "rtl" | "ltr";
  }>;
}>;

export type LearningProgressSubject = Readonly<{
  /** Stable MADAR account identity supplied by the authenticated application shell. */
  accountId: string;
}>;

export type GuideCompletionRecord = Readonly<{
  guideVersion: number;
  completedAt: string;
  mode: GuideRunMode;
}>;

export type GuideProgress = Readonly<{
  guideId: GuideId;
  guideVersion: number;
  status: GuideProgressStatus;
  currentStepId?: GuideStepId;
  startedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  dismissedAt?: string;
  lastSeenAt?: string;
  runMode?: GuideRunMode;
  /** Never discarded by replay; Phase 5 may persist this in an account-backed adapter. */
  completionHistory: readonly GuideCompletionRecord[];
}>;

export interface LearningProgressStore {
  getProgress(subject: LearningProgressSubject, guideId: GuideId): Promise<GuideProgress | null>;
  saveProgress(subject: LearningProgressSubject, progress: GuideProgress): Promise<void>;
  resetProgress(subject: LearningProgressSubject, guideId: GuideId): Promise<void>;
}

export type GuidedLearningEvent =
  | Readonly<{ type: "guide_started"; guideId: GuideId; guideVersion: number; mode: GuideRunMode }>
  | Readonly<{ type: "guide_step_viewed"; guideId: GuideId; guideVersion: number; stepId: GuideStepId; mode: GuideRunMode }>
  | Readonly<{ type: "guide_step_completed"; guideId: GuideId; guideVersion: number; stepId: GuideStepId; mode: GuideRunMode }>
  | Readonly<{ type: "guide_skipped"; guideId: GuideId; guideVersion: number; mode: GuideRunMode }>
  | Readonly<{ type: "guide_dismissed"; guideId: GuideId; guideVersion: number; mode: GuideRunMode }>
  | Readonly<{ type: "guide_completed"; guideId: GuideId; guideVersion: number; mode: GuideRunMode }>
  | Readonly<{ type: "guide_replayed"; guideId: GuideId; guideVersion: number }>
  | Readonly<{ type: "guide_failed"; guideId?: GuideId; code: GuidedLearningErrorCode }>;

export interface GuidedLearningEventSink {
  track(event: GuidedLearningEvent): void | Promise<void>;
}

export const GUIDED_LEARNING_ERROR_CODES = [
  "guide_not_found",
  "duplicate_guide",
  "invalid_definition",
  "invalid_step",
  "invalid_route",
  "invalid_target",
  "duplicate_target",
  "progress_load_failed",
  "progress_write_failed",
  "guide_conflict",
  "guide_already_completed",
  "replay_not_allowed",
  "invalid_runtime_transition",
] as const;

export type GuidedLearningErrorCode = (typeof GUIDED_LEARNING_ERROR_CODES)[number];

export type GuideRuntimeState = Readonly<{
  phase: GuideRuntimePhase;
  guideId?: GuideId;
  journeyId?: JourneyId;
  stepIndex?: number;
  runMode?: GuideRunMode;
}>;
