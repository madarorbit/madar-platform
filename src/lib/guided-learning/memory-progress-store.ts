import type {
  GuideId,
  GuideProgress,
  LearningProgressStore,
  LearningProgressSubject,
} from "./contracts";

const keyFor = (subject: LearningProgressSubject, guideId: GuideId) =>
  `${subject.accountId}:${guideId}`;

const cloneProgress = (progress: GuideProgress): GuideProgress => ({
  ...progress,
  completionHistory: progress.completionHistory.map((record) => ({ ...record })),
});

/** Test/dev adapter only. Production persistence belongs to Phase 5. */
export class MemoryLearningProgressStore implements LearningProgressStore {
  private readonly progress = new Map<string, GuideProgress>();

  async getProgress(
    subject: LearningProgressSubject,
    guideId: GuideId,
  ): Promise<GuideProgress | null> {
    const value = this.progress.get(keyFor(subject, guideId));
    return value ? cloneProgress(value) : null;
  }

  async saveProgress(
    subject: LearningProgressSubject,
    progress: GuideProgress,
  ): Promise<void> {
    this.progress.set(keyFor(subject, progress.guideId), cloneProgress(progress));
  }

  async resetProgress(subject: LearningProgressSubject, guideId: GuideId): Promise<void> {
    this.progress.delete(keyFor(subject, guideId));
  }
}
