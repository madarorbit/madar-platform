import type { GuideDefinition, GuideId, GuideRuntimeState, GuideStep, LearningProgressSubject, StartGuideOptions } from "../index";
import { GuideRegistry, GuidedLearningRuntime } from "../index";

export type GuidedLearningControllerSnapshot = Readonly<{ runtime: GuideRuntimeState; step: GuideStep | null; guide: GuideDefinition | null }>;
type Listener = () => void;

/** Thin UI adapter; Phase 1 runtime remains the only guide-state source of truth. */
export class GuidedLearningController {
  private readonly listeners = new Set<Listener>();
  constructor(readonly runtime: GuidedLearningRuntime, readonly registry: GuideRegistry, readonly subject: LearningProgressSubject) {}

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): GuidedLearningControllerSnapshot => {
    const runtime = this.runtime.getState();
    if (!runtime.guideId) return { runtime, guide: null, step: null };
    let guide: GuideDefinition | null = null;
    try { guide = this.registry.getGuide(runtime.guideId); } catch { return { runtime, guide: null, step: null }; }
    if (!runtime.journeyId || runtime.stepIndex === undefined) return { runtime, guide, step: null };
    const journey = guide.journeys.find((candidate) => candidate.id === runtime.journeyId);
    return { runtime, guide, step: journey?.steps[runtime.stepIndex] ?? null };
  };

  registerGuide(definition: GuideDefinition): GuideDefinition { return this.registry.register(definition); }
  async startGuide(id: GuideId, options: Omit<StartGuideOptions, "subject"> = {}): Promise<GuideRuntimeState> { return this.after(() => this.runtime.startGuide(id, { ...options, subject: this.subject })); }
  async nextStep(): Promise<GuideRuntimeState> { return this.after(() => this.runtime.nextStep(this.subject)); }
  async previousStep(): Promise<GuideRuntimeState> { return this.after(() => this.runtime.previousStep(this.subject)); }
  async pauseGuide(): Promise<GuideRuntimeState> { return this.after(() => this.runtime.pauseGuide(this.subject)); }
  async resumeGuide(): Promise<GuideRuntimeState> { return this.after(() => this.runtime.resumeGuide()); }
  async skipGuide(): Promise<GuideRuntimeState> { return this.after(() => this.runtime.skipGuide(this.subject)); }
  async dismissGuide(): Promise<GuideRuntimeState> { return this.after(() => this.runtime.dismissGuide(this.subject)); }
  async completeGuide(): Promise<GuideRuntimeState> { return this.after(() => this.runtime.completeGuide(this.subject)); }
  async restoreGuide(id: GuideId): Promise<GuideRuntimeState> { return this.after(() => this.runtime.restoreGuide(id, this.subject)); }
  async resetGuide(id: GuideId): Promise<void> { await this.runtime.resetGuide(this.subject, id); this.notify(); }
  clearTerminalState(): void { this.runtime.clearTerminalState(); this.notify(); }
  refresh(): void { this.notify(); }

  private async after(operation: () => Promise<GuideRuntimeState>): Promise<GuideRuntimeState> {
    try { return await operation(); } finally { this.notify(); }
  }
  private notify(): void { for (const listener of this.listeners) listener(); }
}
