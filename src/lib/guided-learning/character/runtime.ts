import { createORBYMotionPlan } from "./intent-adapter";
import type {
  ORBYCharacterDriver,
  ORBYCharacterDriverFactory,
  ORBYLayoutDirection,
  ORBYMotionDirection,
  ORBYMotionFrame,
  ORBYMotionIntent,
  ORBYMotionMode,
} from "./contracts";

export type ORBYCharacterRuntimeSnapshot = Readonly<{
  frame: ORBYMotionFrame;
  driverStatus: "not_requested" | "loading" | "ready" | "fallback";
}>;

type Listener = () => void;
type TimerHandle = ReturnType<typeof setTimeout>;
type Scheduler = Readonly<{
  set: (callback: () => void, delayMs: number) => TimerHandle;
  clear: (handle: TimerHandle) => void;
}>;

const defaultScheduler: Scheduler = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle),
};

const INITIAL_FRAME: ORBYMotionFrame = {
  sequence: 0,
  intent: "idle",
  direction: "neutral",
  layoutDirection: "rtl",
  mode: "still",
  active: false,
};

/**
 * Technology-neutral semantic sequencer. It owns no animation frames: a future
 * Rive driver owns rendering frames while this runtime only coordinates sparse
 * semantic changes and rejects stale scheduled stages.
 */
export class ORBYCharacterRuntime {
  private readonly listeners = new Set<Listener>();
  private readonly timers = new Set<TimerHandle>();
  private snapshot: ORBYCharacterRuntimeSnapshot = {
    frame: INITIAL_FRAME,
    driverStatus: "not_requested",
  };
  private driver: ORBYCharacterDriver | null = null;
  private driverPromise: Promise<void> | null = null;
  private sequence = 0;
  private disposed = false;

  constructor(
    private readonly options: Readonly<{
      driverFactory?: ORBYCharacterDriverFactory;
      scheduler?: Scheduler;
    }> = {},
  ) {}

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ORBYCharacterRuntimeSnapshot => this.snapshot;

  async present(input: Readonly<{
    intent: ORBYMotionIntent;
    direction: ORBYMotionDirection;
    layoutDirection: ORBYLayoutDirection;
    reducedMotion: boolean;
  }>): Promise<number> {
    if (this.disposed) return this.sequence;
    const previous = this.snapshot.frame;
    if (
      previous.active &&
      previous.intent === input.intent &&
      previous.direction === input.direction &&
      previous.layoutDirection === input.layoutDirection &&
      previous.mode === motionMode(input.reducedMotion)
    ) {
      return previous.sequence;
    }

    const sequence = this.beginSequence();
    void this.ensureDriver();
    const stages = createORBYMotionPlan(input);
    const entering = !previous.active && !input.reducedMotion;
    if (entering) {
      this.apply(sequence, "enter", input.direction, input.layoutDirection, "animated", true);
    }
    const offset = entering ? 85 : 0;
    for (const stage of stages) {
      this.schedule(sequence, offset + stage.delayMs, () => {
        this.apply(sequence, stage.intent, stage.direction, input.layoutDirection, motionMode(input.reducedMotion), true);
      });
    }
    return sequence;
  }

  react(
    intent: Extract<ORBYMotionIntent, "confirm" | "celebrate" | "attention">,
    reducedMotion: boolean,
  ): number {
    const sequence = this.beginSequence();
    const frame = this.snapshot.frame;
    this.apply(sequence, intent, frame.direction, frame.layoutDirection, motionMode(reducedMotion), true);
    return sequence;
  }

  exit(input: Readonly<{ reason: "complete" | "dismiss" | "skip" | "interrupt"; reducedMotion: boolean }>): number {
    const sequence = this.beginSequence();
    const frame = this.snapshot.frame;
    // Completion is the only terminal path that may celebrate. Dismiss/skip
    // never imply success.
    if (input.reason === "complete" && !input.reducedMotion) {
      this.apply(sequence, "celebrate", frame.direction, frame.layoutDirection, "animated", true);
      this.schedule(sequence, 150, () => this.apply(sequence, "exit", frame.direction, frame.layoutDirection, "animated", false));
    } else {
      this.apply(sequence, "exit", frame.direction, frame.layoutDirection, motionMode(input.reducedMotion), false);
    }
    return sequence;
  }

  setDocumentVisible(visible: boolean): void {
    this.driver?.setDocumentVisible?.(visible);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelTimers();
    this.driver?.dispose?.();
    this.driver = null;
    this.listeners.clear();
  }

  private async ensureDriver(): Promise<void> {
    if (!this.options.driverFactory || this.driver || this.driverPromise || this.disposed) return;
    this.setDriverStatus("loading");
    this.driverPromise = this.options.driverFactory()
      .then((driver) => {
        if (this.disposed) {
          driver.dispose?.();
          return;
        }
        this.driver = driver;
        this.setDriverStatus("ready");
        driver.apply(this.snapshot.frame);
      })
      .catch(() => {
        if (!this.disposed) this.setDriverStatus("fallback");
      })
      .finally(() => {
        this.driverPromise = null;
      });
    await this.driverPromise;
  }

  private beginSequence(): number {
    this.cancelTimers();
    this.sequence += 1;
    return this.sequence;
  }

  private schedule(sequence: number, delayMs: number, operation: () => void): void {
    if (delayMs <= 0) {
      if (sequence === this.sequence && !this.disposed) operation();
      return;
    }
    const scheduler = this.options.scheduler ?? defaultScheduler;
    const handle = scheduler.set(() => {
      this.timers.delete(handle);
      if (sequence === this.sequence && !this.disposed) operation();
    }, delayMs);
    this.timers.add(handle);
  }

  private cancelTimers(): void {
    const scheduler = this.options.scheduler ?? defaultScheduler;
    for (const timer of this.timers) scheduler.clear(timer);
    this.timers.clear();
  }

  private apply(
    sequence: number,
    intent: ORBYMotionIntent,
    direction: ORBYMotionDirection,
    layoutDirection: ORBYLayoutDirection,
    mode: ORBYMotionMode,
    active: boolean,
  ): void {
    if (sequence !== this.sequence || this.disposed) return;
    const frame: ORBYMotionFrame = { sequence, intent, direction, layoutDirection, mode, active };
    this.snapshot = { ...this.snapshot, frame };
    this.driver?.apply(frame);
    this.notify();
  }

  private setDriverStatus(driverStatus: ORBYCharacterRuntimeSnapshot["driverStatus"]): void {
    if (this.snapshot.driverStatus === driverStatus) return;
    this.snapshot = { ...this.snapshot, driverStatus };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

function motionMode(reducedMotion: boolean): ORBYMotionMode {
  return reducedMotion ? "still" : "animated";
}
