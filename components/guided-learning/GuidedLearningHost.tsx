"use client";

import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { GuideGeometry, GuideSpotlightGeometry, GuideTargetResolutionState } from "@/src/lib/guided-learning/browser";
import {
  computeCutoutBlockers,
  computeGuidePlacement,
  computeSpotlightGeometry,
  getGuideViewport,
  inferTargetRadius,
  measureGuideTarget,
  pointerPolicyForStep,
  scrollGuideTargetIntoView,
  trackGuideTarget,
  waitForGuideTarget,
  type GuidedLearningController,
} from "@/src/lib/guided-learning/browser";
import {
  ORBYCharacterRuntime,
  resolveORBYPresentationRequest,
} from "@/src/lib/guided-learning/character";

const ORBYGuidePresentation = lazy(() => import("@/components/guided-learning/ORBYGuidePresentation"));

type VisualState = Readonly<{
  key: string;
  resolution: GuideTargetResolutionState;
  geometry: GuideGeometry | null;
  spotlight: GuideSpotlightGeometry | null;
}>;

const subscribeClientReady = () => () => undefined;
const getClientReady = () => true;
const getServerReady = () => false;
const pageDirection = () => typeof document !== "undefined" && document.documentElement.dir === "ltr" ? "ltr" as const : "rtl" as const;
const prefersReducedMotion = () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
const briefDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function geometryState(key: string, element: Element, geometry = measureGuideTarget(element)): VisualState {
  const viewport = getGuideViewport();
  return {
    key,
    resolution: "resolved",
    geometry,
    spotlight: computeSpotlightGeometry(geometry, viewport, { padding: 8, radius: inferTargetRadius(element) + 8 }),
  };
}

export default function GuidedLearningHost({ controller }: { controller: GuidedLearningController }) {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const clientReady = useSyncExternalStore(subscribeClientReady, getClientReady, getServerReady);
  const [visual, setVisual] = useState<VisualState>({ key: "", resolution: "unavailable", geometry: null, spotlight: null });
  const [surfaceSize, setSurfaceSize] = useState({ width: 420, height: 230 });
  const [transitioning, setTransitioning] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [characterRuntime] = useState(() => new ORBYCharacterRuntime());
  const characterSnapshot = useSyncExternalStore(characterRuntime.subscribe, characterRuntime.getSnapshot, characterRuntime.getSnapshot);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const resolutionSequence = useRef(0);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => controller.subscribe(() => rerender()), [controller]);

  const { runtime, guide, step } = controller.getSnapshot();
  const active = runtime.phase === "active" && Boolean(guide && step);
  const pointerPolicy = step ? pointerPolicyForStep(step) : "block_background";
  const stepKey = active && guide && step ? `${guide.id}:${runtime.journeyId ?? "journey"}:${runtime.stepIndex ?? 0}:${retryKey}` : "";
  const currentVisual: VisualState = visual.key === stepKey
    ? visual
    : {
        key: stepKey,
        resolution: step?.target ? "pending" : "resolved",
        geometry: visual.geometry,
        spotlight: visual.spotlight,
      };

  const run = useCallback(async (operation: () => Promise<unknown>) => {
    if (transitioning) return;
    setTransitioning(true);
    try {
      await operation();
    } finally {
      setTransitioning(false);
    }
  }, [transitioning]);

  const runTerminal = useCallback(async (
    reason: "complete" | "dismiss" | "skip",
    operation: () => Promise<unknown>,
  ) => {
    if (transitioning) return;
    setTransitioning(true);
    const reducedMotion = prefersReducedMotion();
    characterRuntime.exit({ reason, reducedMotion });
    try {
      if (!reducedMotion) await briefDelay(reason === "complete" ? 170 : 90);
      await operation();
    } finally {
      setTransitioning(false);
    }
  }, [characterRuntime, transitioning]);

  useEffect(() => {
    if (!active || !step || !stepKey) return;
    const sequence = ++resolutionSequence.current;
    const abort = new AbortController();
    let stopTracking: (() => void) | null = null;
    void Promise.resolve().then(async () => {
      if (abort.signal.aborted || sequence !== resolutionSequence.current) return;
      if (!step.target) {
        setVisual({ key: stepKey, resolution: "resolved", geometry: null, spotlight: null });
        return;
      }
      const result = await waitForGuideTarget([step.target.id], {
        timeoutMs: step.route?.waitForTarget ? 2400 : 1000,
        signal: abort.signal,
        onState: (state) => {
          if (abort.signal.aborted || sequence !== resolutionSequence.current) return;
          setVisual((previous) => ({ key: stepKey, resolution: state, geometry: previous.geometry, spotlight: previous.spotlight }));
        },
      });
      if (abort.signal.aborted || sequence !== resolutionSequence.current) return;
      if (result.state !== "resolved" || !result.element) {
        setVisual({ key: stepKey, resolution: result.state, geometry: null, spotlight: null });
        return;
      }
      await scrollGuideTargetIntoView(result.element, { reducedMotion: prefersReducedMotion() });
      if (abort.signal.aborted || sequence !== resolutionSequence.current || !result.element.isConnected) return;
      setVisual(geometryState(stepKey, result.element));
      stopTracking = trackGuideTarget(result.element, (state, geometry) => {
        if (abort.signal.aborted || sequence !== resolutionSequence.current) return;
        if (!geometry) {
          setVisual({ key: stepKey, resolution: state, geometry: null, spotlight: null });
          return;
        }
        setVisual(geometryState(stepKey, result.element!, geometry));
      });
    });
    return () => {
      abort.abort();
      stopTracking?.();
    };
  }, [active, step, stepKey]);

  useEffect(() => {
    if (!active || !surfaceRef.current || typeof ResizeObserver === "undefined") return;
    const surface = surfaceRef.current;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = surface.getBoundingClientRect();
      setSurfaceSize({ width: rect.width, height: rect.height });
    };
    frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    });
    observer.observe(surface);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active, currentVisual.resolution, runtime.stepIndex]);

  useEffect(() => {
    if (!active || pointerPolicy !== "block_background") return;
    const root = document.querySelector<HTMLElement>("[data-madar-guide-app-root]");
    if (!root) return;
    const previousAriaHidden = root.getAttribute("aria-hidden");
    const previousInert = root.inert;
    root.inert = true;
    root.setAttribute("aria-hidden", "true");
    return () => {
      root.inert = previousInert;
      if (previousAriaHidden === null) root.removeAttribute("aria-hidden");
      else root.setAttribute("aria-hidden", previousAriaHidden);
    };
  }, [active, pointerPolicy]);

  useEffect(() => {
    if (!active) return;
    if (!restoreFocusRef.current && document.activeElement instanceof HTMLElement) restoreFocusRef.current = document.activeElement;
    if (pointerPolicy === "block_background" && surfaceRef.current && !transitioning) surfaceRef.current.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (guide?.completion.allowDismiss) void runTerminal("dismiss", () => controller.dismissGuide());
        else if (guide?.completion.allowSkip) void runTerminal("skip", () => controller.skipGuide());
        return;
      }
      if (event.key !== "Tab" || pointerPolicy !== "block_background" || !surfaceRef.current) return;
      const items = Array.from(surfaceRef.current.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])"));
      if (!items.length) {
        event.preventDefault();
        surfaceRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [active, controller, guide, pointerPolicy, runTerminal, transitioning]);

  useEffect(() => {
    if (active) return;
    const restore = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (restore?.isConnected) restore.focus({ preventScroll: true });
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const visibility = () => characterRuntime.setDocumentVisible(!document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [active, characterRuntime]);

  useEffect(() => () => characterRuntime.dispose(), [characterRuntime]);

  const viewport = active && clientReady ? getGuideViewport() : { width: 0, height: 0 };
  const targetTransitioning = currentVisual.resolution === "pending";
  const movingBetweenTargets = targetTransitioning && Boolean(currentVisual.spotlight);
  const direction = pageDirection();
  const placement = computeGuidePlacement({
    target: currentVisual.geometry,
    viewport,
    surface: surfaceSize,
    requested: movingBetweenTargets ? "auto" : step?.placementHint,
    direction,
  });
  const characterRequest = step ? resolveORBYPresentationRequest({
    guideIntent: step.character?.intent,
    guideDirection: step.character?.direction,
    placement: placement.placement,
    pageDirection: direction,
    targetState: currentVisual.resolution,
    reducedMotion: prefersReducedMotion(),
  }) : null;
  const characterIntent = characterRequest?.intent ?? null;
  const characterDirection = characterRequest?.direction ?? null;
  const characterLayoutDirection = characterRequest?.layoutDirection ?? null;

  useEffect(() => {
    if (!active || !characterIntent || !characterDirection || !characterLayoutDirection) return;
    void characterRuntime.present({
      intent: characterIntent,
      direction: characterDirection,
      layoutDirection: characterLayoutDirection,
      reducedMotion: prefersReducedMotion(),
    });
  }, [active, characterDirection, characterIntent, characterLayoutDirection, characterRuntime, stepKey]);

  if (!clientReady || !active || !guide || !step) return null;

  const blockers = currentVisual.spotlight && pointerPolicy === "allow_target"
    ? computeCutoutBlockers(currentVisual.spotlight, viewport)
    : [];
  const unavailable = Boolean(step.target) && currentVisual.resolution !== "resolved" && currentVisual.resolution !== "pending";
  const currentIndex = (runtime.stepIndex ?? 0) + 1;
  const total = guide.journeys.find((candidate) => candidate.id === runtime.journeyId)?.steps.length ?? currentIndex;
  const status = movingBetweenTargets
    ? "جارٍ الانتقال إلى الخطوة التالية…"
    : targetTransitioning
      ? "جارٍ تجهيز العنصر…"
      : null;
  const warning = unavailable
    ? "تعذر الوصول إلى العنصر الآن. تقدر تعيد المحاولة بدون إيقاف الجولة."
    : null;

  const actions = (
    <div className="md-guide-actions">
      {currentIndex > 1 ? (
        <button type="button" className="md-button md-button-ghost md-button-sm" disabled={transitioning || movingBetweenTargets} onClick={() => void run(() => controller.previousStep())}>
          السابق
        </button>
      ) : null}
      {unavailable ? (
        <button type="button" className="md-button md-button-secondary md-button-sm" disabled={transitioning} onClick={() => setRetryKey((value) => value + 1)}>
          إعادة المحاولة
        </button>
      ) : (
        <button
          type="button"
          className="md-button md-button-primary md-button-sm"
          disabled={transitioning || targetTransitioning}
          onClick={() => void (currentIndex >= total
            ? runTerminal("complete", () => controller.nextStep())
            : run(() => controller.nextStep()))}
        >
          {currentIndex >= total ? "إنهاء" : "التالي"}
        </button>
      )}
      {step.target?.optional && unavailable ? (
        <button type="button" className="md-button md-button-ghost md-button-sm" disabled={transitioning} onClick={() => void run(() => controller.nextStep())}>
          تجاوز الخطوة
        </button>
      ) : null}
      {guide.completion.allowSkip ? (
        <button type="button" className="md-button md-button-ghost md-button-sm" disabled={transitioning || movingBetweenTargets} onClick={() => void runTerminal("skip", () => controller.skipGuide())}>
          تخطي الجولة
        </button>
      ) : null}
      {guide.completion.allowDismiss ? (
        <button type="button" className="md-guide-close" disabled={transitioning || movingBetweenTargets} onClick={() => void runTerminal("dismiss", () => controller.dismissGuide())} aria-label="إغلاق إرشاد ORBY">
          ×
        </button>
      ) : null}
    </div>
  );

  return createPortal(
    <div className="md-guide-host" data-guide-resolution={currentVisual.resolution} data-guide-pointer-policy={pointerPolicy}>
      {currentVisual.spotlight ? (
        <div
          className="md-guide-spotlight"
          aria-hidden="true"
          style={{
            top: currentVisual.spotlight.top,
            left: currentVisual.spotlight.left,
            width: currentVisual.spotlight.width,
            height: currentVisual.spotlight.height,
            borderRadius: currentVisual.spotlight.radius,
          }}
        />
      ) : <div className="md-guide-dimmer" aria-hidden="true" />}
      {pointerPolicy === "block_background" ? <div className="md-guide-pointer-blocker" aria-hidden="true" /> : null}
      {pointerPolicy === "allow_target" ? blockers.map((rect, index) => (
        <div key={index} className="md-guide-pointer-slice" aria-hidden="true" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      )) : null}
      <div
        ref={surfaceRef}
        className="md-guide-surface md-orby-guide-surface"
        role={pointerPolicy === "block_background" ? "dialog" : "group"}
        aria-modal={pointerPolicy === "block_background" ? true : undefined}
        aria-label="إرشاد ORBY"
        tabIndex={-1}
        data-guide-placement={placement.placement}
        style={{ transform: `translate3d(${placement.x}px, ${placement.y}px, 0)`, maxWidth: Math.min(480, placement.maxWidth) }}
      >
        <Suspense fallback={<div className="md-guide-status" role="status">جارٍ تجهيز ORBY…</div>}>
          <ORBYGuidePresentation
            character={characterSnapshot}
            currentIndex={currentIndex}
            total={total}
            title={movingBetweenTargets ? undefined : step.content.title?.defaultText}
            message={movingBetweenTargets ? "ثانية، وبوريك المكان التالي." : step.content.message.defaultText}
            hint={movingBetweenTargets ? undefined : step.content.hint?.defaultText}
            status={status}
            warning={warning}
            actions={actions}
          />
        </Suspense>
      </div>
    </div>,
    document.body,
  );
}