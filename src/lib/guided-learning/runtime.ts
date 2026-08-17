import type {
  GuideDefinition,
  GuideId,
  GuideJourney,
  GuideProgress,
  GuideRunMode,
  GuideRuntimeState,
  GuidedLearningEvent,
  GuidedLearningEventSink,
  LearningProgressStore,
  LearningProgressSubject,
  JourneyId,
} from "./contracts";
import { GuidedLearningError } from "./errors";
import { GuideRegistry } from "./registry";

const NOOP_EVENT_SINK: GuidedLearningEventSink = { track: () => undefined };

export type GuidedLearningRuntimeOptions = Readonly<{
  registry: GuideRegistry;
  progressStore: LearningProgressStore;
  events?: GuidedLearningEventSink;
  now?: () => Date;
}>;

export type StartGuideOptions = Readonly<{
  subject: LearningProgressSubject;
  mode?: GuideRunMode;
  journeyId?: JourneyId;
}>;

export class GuidedLearningRuntime {
  private readonly registry: GuideRegistry;
  private readonly progressStore: LearningProgressStore;
  private readonly events: GuidedLearningEventSink;
  private readonly now: () => Date;
  private state: GuideRuntimeState = { phase: "idle" };

  constructor(options: GuidedLearningRuntimeOptions) {
    this.registry = options.registry;
    this.progressStore = options.progressStore;
    this.events = options.events ?? NOOP_EVENT_SINK;
    this.now = options.now ?? (() => new Date());
  }

  getState(): GuideRuntimeState {
    return this.state;
  }

  markEligible(candidates: readonly GuideDefinition[]): GuideDefinition | null {
    this.assertNoForeground();
    const selected = this.registry.selectForeground(candidates);
    this.state = selected ? { phase: "eligible", guideId: selected.id } : { phase: "idle" };
    return selected;
  }

  async startGuide(id: GuideId, options: StartGuideOptions): Promise<GuideRuntimeState> {
    this.assertCanStart(id);
    const definition = this.registry.getGuide(id);
    const mode = options.mode ?? "standard";
    if (mode === "replay" && !definition.replay.allowed) {
      throw new GuidedLearningError("replay_not_allowed", `Replay is not allowed for guide ${id}.`, {
        guideId: id,
      });
    }

    const previous = await this.readProgress(options.subject, id);
    if (mode === "standard" && previous?.status === "completed") {
      throw new GuidedLearningError(
        "guide_already_completed",
        `Guide ${id} is already completed; start it in replay mode instead.`,
        { guideId: id },
      );
    }

    const journey = this.resolveJourney(definition, options.journeyId);
    const timestamp = this.now().toISOString();
    this.state = { phase: "starting", guideId: id, journeyId: journey.id, runMode: mode };

    const progress: GuideProgress = {
      guideId: id,
      guideVersion: definition.version,
      status: "in_progress",
      currentStepId: journey.steps[0].id,
      startedAt: timestamp,
      lastSeenAt: timestamp,
      runMode: mode,
      completionHistory: previous?.completionHistory ?? [],
    };
    await this.writeProgress(options.subject, progress);

    this.state = {
      phase: "active",
      guideId: id,
      journeyId: journey.id,
      stepIndex: 0,
      runMode: mode,
    };
    if (mode === "replay") {
      await this.emit({ type: "guide_replayed", guideId: id, guideVersion: definition.version });
    }
    await this.emit({ type: "guide_started", guideId: id, guideVersion: definition.version, mode });
    await this.emit({
      type: "guide_step_viewed",
      guideId: id,
      guideVersion: definition.version,
      stepId: journey.steps[0].id,
      mode,
    });
    return this.state;
  }

  async nextStep(subject: LearningProgressSubject): Promise<GuideRuntimeState> {
    const session = this.requireActive();
    const definition = this.registry.getGuide(session.guideId);
    const journey = this.resolveJourney(definition, session.journeyId);
    const currentStep = journey.steps[session.stepIndex];
    await this.emit({
      type: "guide_step_completed",
      guideId: definition.id,
      guideVersion: definition.version,
      stepId: currentStep.id,
      mode: session.runMode,
    });

    if (session.stepIndex >= journey.steps.length - 1) {
      return this.completeGuide(subject);
    }

    const nextIndex = session.stepIndex + 1;
    const nextStep = journey.steps[nextIndex];
    const previous = await this.readRequiredProgress(subject, definition.id);
    const timestamp = this.now().toISOString();
    await this.writeProgress(subject, {
      ...previous,
      status: "in_progress",
      currentStepId: nextStep.id,
      lastSeenAt: timestamp,
    });
    this.state = { ...session, stepIndex: nextIndex };
    await this.emit({
      type: "guide_step_viewed",
      guideId: definition.id,
      guideVersion: definition.version,
      stepId: nextStep.id,
      mode: session.runMode,
    });
    return this.state;
  }

  async previousStep(subject: LearningProgressSubject): Promise<GuideRuntimeState> {
    const session = this.requireActive();
    if (session.stepIndex === 0) return this.state;
    const definition = this.registry.getGuide(session.guideId);
    const journey = this.resolveJourney(definition, session.journeyId);
    const previousIndex = session.stepIndex - 1;
    const previousStep = journey.steps[previousIndex];
    const progress = await this.readRequiredProgress(subject, definition.id);
    await this.writeProgress(subject, {
      ...progress,
      currentStepId: previousStep.id,
      lastSeenAt: this.now().toISOString(),
    });
    this.state = { ...session, stepIndex: previousIndex };
    await this.emit({
      type: "guide_step_viewed",
      guideId: definition.id,
      guideVersion: definition.version,
      stepId: previousStep.id,
      mode: session.runMode,
    });
    return this.state;
  }

  async pauseGuide(subject: LearningProgressSubject): Promise<GuideRuntimeState> {
    const session = this.requireActive();
    const progress = await this.readRequiredProgress(subject, session.guideId);
    await this.writeProgress(subject, { ...progress, lastSeenAt: this.now().toISOString() });
    this.state = { ...session, phase: "paused" };
    return this.state;
  }

  async resumeGuide(): Promise<GuideRuntimeState> {
    if (this.state.phase === "paused" && this.state.guideId) {
      this.state = { ...this.state, phase: "active" };
      return this.state;
    }
    if (this.state.phase !== "idle") {
      throw new GuidedLearningError("invalid_runtime_transition", "Runtime must be idle to restore progress.");
    }
    throw new GuidedLearningError(
      "invalid_runtime_transition",
      "Use restoreGuide(id, subject) when resuming after runtime recreation.",
    );
  }

  async restoreGuide(id: GuideId, subject: LearningProgressSubject): Promise<GuideRuntimeState> {
    this.assertNoForeground();
    const definition = this.registry.getGuide(id);
    const progress = await this.readRequiredProgress(subject, id);
    if (progress.status !== "in_progress" || !progress.currentStepId) {
      throw new GuidedLearningError(
        "invalid_runtime_transition",
        `Guide ${id} has no resumable in-progress state.`,
        { guideId: id },
      );
    }
    for (const journey of definition.journeys) {
      const stepIndex = journey.steps.findIndex((step) => step.id === progress.currentStepId);
      if (stepIndex >= 0) {
        this.state = {
          phase: "active",
          guideId: id,
          journeyId: journey.id,
          stepIndex,
          runMode: progress.runMode ?? "standard",
        };
        return this.state;
      }
    }
    throw new GuidedLearningError("invalid_step", `Stored step no longer exists for guide ${id}.`, {
      guideId: id,
      stepId: progress.currentStepId,
    });
  }

  async skipGuide(subject: LearningProgressSubject): Promise<GuideRuntimeState> {
    const session = this.requireForegroundSession();
    const definition = this.registry.getGuide(session.guideId);
    if (!definition.completion.allowSkip) {
      throw new GuidedLearningError("invalid_runtime_transition", `Guide ${definition.id} cannot be skipped.`, {
        guideId: definition.id,
      });
    }
    const progress = await this.readRequiredProgress(subject, definition.id);
    const timestamp = this.now().toISOString();
    await this.writeProgress(subject, {
      ...progress,
      status: "skipped",
      skippedAt: timestamp,
      lastSeenAt: timestamp,
    });
    this.state = { ...session, phase: "skipped" };
    await this.emit({
      type: "guide_skipped",
      guideId: definition.id,
      guideVersion: definition.version,
      mode: session.runMode,
    });
    return this.state;
  }

  async dismissGuide(subject: LearningProgressSubject): Promise<GuideRuntimeState> {
    const session = this.requireForegroundSession();
    const definition = this.registry.getGuide(session.guideId);
    if (!definition.completion.allowDismiss) {
      throw new GuidedLearningError(
        "invalid_runtime_transition",
        `Guide ${definition.id} cannot be dismissed.`,
        { guideId: definition.id },
      );
    }
    const progress = await this.readRequiredProgress(subject, definition.id);
    const timestamp = this.now().toISOString();
    await this.writeProgress(subject, {
      ...progress,
      status: "dismissed",
      dismissedAt: timestamp,
      lastSeenAt: timestamp,
    });
    this.state = { ...session, phase: "dismissed" };
    await this.emit({
      type: "guide_dismissed",
      guideId: definition.id,
      guideVersion: definition.version,
      mode: session.runMode,
    });
    return this.state;
  }

  async completeGuide(subject: LearningProgressSubject): Promise<GuideRuntimeState> {
    const session = this.requireForegroundSession();
    const definition = this.registry.getGuide(session.guideId);
    const progress = await this.readRequiredProgress(subject, definition.id);
    const timestamp = this.now().toISOString();
    await this.writeProgress(subject, {
      ...progress,
      status: "completed",
      completedAt: timestamp,
      lastSeenAt: timestamp,
      completionHistory: [
        ...progress.completionHistory,
        { guideVersion: definition.version, completedAt: timestamp, mode: session.runMode },
      ],
    });
    this.state = { ...session, phase: "completed" };
    await this.emit({
      type: "guide_completed",
      guideId: definition.id,
      guideVersion: definition.version,
      mode: session.runMode,
    });
    return this.state;
  }

  async resetGuide(subject: LearningProgressSubject, guideId: GuideId): Promise<void> {
    try {
      await this.progressStore.resetProgress(subject, guideId);
    } catch (cause) {
      throw new GuidedLearningError("progress_write_failed", `Failed to reset progress for ${guideId}.`, {
        guideId,
        cause,
      });
    }
    if (this.state.guideId === guideId) this.state = { phase: "idle" };
  }

  clearTerminalState(): void {
    if (["completed", "skipped", "dismissed", "failed"].includes(this.state.phase)) {
      this.state = { phase: "idle" };
    }
  }

  private resolveJourney(definition: GuideDefinition, journeyId?: JourneyId): GuideJourney {
    const wanted = journeyId ?? definition.defaultJourneyId;
    const journey = definition.journeys.find((candidate) => candidate.id === wanted);
    if (!journey) {
      throw new GuidedLearningError("invalid_definition", `Journey ${wanted} not found.`, {
        guideId: definition.id,
      });
    }
    return journey;
  }

  private assertCanStart(id: GuideId): void {
    if (
      this.state.phase === "active" ||
      this.state.phase === "paused" ||
      this.state.phase === "starting"
    ) {
      throw new GuidedLearningError(
        "guide_conflict",
        `Cannot start ${id}; ${this.state.guideId ?? "another guide"} owns the foreground.`,
        { guideId: id },
      );
    }
  }

  private assertNoForeground(): void {
    if (["active", "paused", "starting"].includes(this.state.phase)) {
      throw new GuidedLearningError("guide_conflict", "A foreground guide is already active.", {
        guideId: this.state.guideId,
      });
    }
  }

  private requireActive(): {
    phase: "active";
    guideId: GuideId;
    journeyId: JourneyId;
    stepIndex: number;
    runMode: GuideRunMode;
  } {
    if (
      this.state.phase !== "active" ||
      !this.state.guideId ||
      !this.state.journeyId ||
      this.state.stepIndex === undefined ||
      !this.state.runMode
    ) {
      throw new GuidedLearningError("invalid_runtime_transition", "No active guide session.");
    }
    return {
      phase: "active",
      guideId: this.state.guideId,
      journeyId: this.state.journeyId,
      stepIndex: this.state.stepIndex,
      runMode: this.state.runMode,
    };
  }

  private requireForegroundSession(): {
    phase: "active" | "paused";
    guideId: GuideId;
    journeyId: JourneyId;
    stepIndex: number;
    runMode: GuideRunMode;
  } {
    if (
      (this.state.phase !== "active" && this.state.phase !== "paused") ||
      !this.state.guideId ||
      !this.state.journeyId ||
      this.state.stepIndex === undefined ||
      !this.state.runMode
    ) {
      throw new GuidedLearningError("invalid_runtime_transition", "No foreground guide session.");
    }
    return {
      phase: this.state.phase,
      guideId: this.state.guideId,
      journeyId: this.state.journeyId,
      stepIndex: this.state.stepIndex,
      runMode: this.state.runMode,
    };
  }

  private async readProgress(
    subject: LearningProgressSubject,
    guideId: GuideId,
  ): Promise<GuideProgress | null> {
    try {
      return await this.progressStore.getProgress(subject, guideId);
    } catch (cause) {
      await this.emit({ type: "guide_failed", guideId, code: "progress_load_failed" });
      throw new GuidedLearningError(
        "progress_load_failed",
        `Failed to load progress for ${guideId}.`,
        { guideId, cause },
      );
    }
  }

  private async readRequiredProgress(
    subject: LearningProgressSubject,
    guideId: GuideId,
  ): Promise<GuideProgress> {
    const progress = await this.readProgress(subject, guideId);
    if (!progress) {
      throw new GuidedLearningError(
        "invalid_runtime_transition",
        `Progress for ${guideId} does not exist.`,
        { guideId },
      );
    }
    return progress;
  }

  private async writeProgress(
    subject: LearningProgressSubject,
    progress: GuideProgress,
  ): Promise<void> {
    try {
      await this.progressStore.saveProgress(subject, progress);
    } catch (cause) {
      await this.emit({
        type: "guide_failed",
        guideId: progress.guideId,
        code: "progress_write_failed",
      });
      this.state = { phase: "failed", guideId: progress.guideId };
      throw new GuidedLearningError(
        "progress_write_failed",
        `Failed to write progress for ${progress.guideId}.`,
        { guideId: progress.guideId, cause },
      );
    }
  }

  private async emit(event: GuidedLearningEvent): Promise<void> {
    await this.events.track(event);
  }
}
