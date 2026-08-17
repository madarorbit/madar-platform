"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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

const direction = () => typeof document !== "undefined" && document.documentElement.dir === "ltr" ? "ltr" as const : "rtl" as const;

export default function GuidedLearningHost({ controller }: { controller: GuidedLearningController }) {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const [mounted, setMounted] = useState(false);
  const [resolution, setResolution] = useState<GuideTargetResolutionState>("unavailable");
  const [targetGeometry, setTargetGeometry] = useState<GuideGeometry | null>(null);
  const [spotlight, setSpotlight] = useState<GuideSpotlightGeometry | null>(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: 360, height: 210 });
  const [transitioning, setTransitioning] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const resolutionSequence = useRef(0);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => controller.subscribe(() => rerender()), [controller]);
  useEffect(() => setMounted(true), []);

  const { runtime, guide, step } = controller.getSnapshot();
  const active = runtime.phase === "active" && Boolean(guide && step);
  const pointerPolicy = step ? pointerPolicyForStep(step) : "block_background";

  const applyGeometry = useCallback((element: Element, geometry = measureGuideTarget(element)) => {
    const viewport = getGuideViewport();
    setTargetGeometry(geometry);
    setSpotlight(computeSpotlightGeometry(geometry, viewport, {
      padding: 8,
      radius: inferTargetRadius(element) + 8,
    }));
  }, []);

  useEffect(() => {
    if (!active || !step) {
      setTargetGeometry(null);
      setSpotlight(null);
      setResolution("unavailable");
      return;
    }
    const sequence = ++resolutionSequence.current;
    const abort = new AbortController();
    let stopTracking: (() => void) | null = null;
    setTransitioning(true);
    setTargetGeometry(null);
    setSpotlight(null);

    if (!step.target) {
      setResolution("resolved");
      setTransitioning(false);
      return () => abort.abort();
    }

    void (async () => {
      const result = await waitForGuideTarget([step.target!.id], {
        timeoutMs: step.route?.waitForTarget ? 2400 : 1000,
        signal: abort.signal,
        onState: (state) => sequence === resolutionSequence.current && setResolution(state),
      });
      if (abort.signal.aborted || sequence !== resolutionSequence.current) return;
      if (result.state !== "resolved" || !result.element) {
        setResolution(result.state);
        setTransitioning(false);
        return;
      }
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      await scrollGuideTargetIntoView(result.element, { reducedMotion });
      if (abort.signal.aborted || sequence !== resolutionSequence.current || !result.element.isConnected) return;
      applyGeometry(result.element);
      setResolution("resolved");
      setTransitioning(false);
      stopTracking = trackGuideTarget(result.element, (state, geometry) => {
        if (sequence !== resolutionSequence.current) return;
        setResolution(state);
        if (!geometry) {
          setTargetGeometry(null);
          setSpotlight(null);
          return;
        }
        applyGeometry(result.element!, geometry);
      });
    })();

    return () => {
      abort.abort();
      stopTracking?.();
    };
  }, [active, applyGeometry, retryKey, runtime.guideId, runtime.journeyId, runtime.stepIndex, step]);

  useEffect(() => {
    if (!active || !surfaceRef.current || typeof ResizeObserver === "undefined") return;
    const surface = surfaceRef.current;
    const measure = () => {
      const rect = surface.getBoundingClientRect();
      setSurfaceSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [active, resolution, runtime.stepIndex]);

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
        if (guide?.completion.allowDismiss) void controller.dismissGuide();
        else if (guide?.completion.allowSkip) void controller.skipGuide();
        return;
      }
      if (event.key !== "Tab" || pointerPolicy !== "block_background" || !surfaceRef.current) return;
      const items = Array.from(surfaceRef.current.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])"));
      if (!items.length) {
        event.preventDefault();
        surfaceRef.current.focus();
        return;
      }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [active, controller, guide, pointerPolicy, transitioning]);

  useEffect(() => {
    if (active) return;
    const restore = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (restore?.isConnected) restore.focus({ preventScroll: true });
  }, [active]);

  const run = useCallback(async (operation: () => Promise<unknown>) => {
    if (transitioning) return;
    setTransitioning(true);
    try { await operation(); } finally { setTransitioning(false); }
  }, [transitioning]);

  const viewport = active && mounted ? getGuideViewport() : { width: 0, height: 0 };
  const placement = useMemo(() => computeGuidePlacement({
    target: targetGeometry,
    viewport,
    surface: surfaceSize,
    requested: step?.placementHint,
    direction: direction(),
  }), [step?.placementHint, surfaceSize, targetGeometry, viewport]);

  if (!mounted || !active || !guide || !step) return null;
  const blockers = spotlight && pointerPolicy === "allow_target" ? computeCutoutBlockers(spotlight, viewport) : [];
  const unavailable = Boolean(step.target) && resolution !== "resolved" && resolution !== "pending";
  const currentIndex = (runtime.stepIndex ?? 0) + 1;
  const total = guide.journeys.find((candidate) => candidate.id === runtime.journeyId)?.steps.length ?? currentIndex;

  return createPortal(
    <div className="md-guide-host" data-guide-resolution={resolution} data-guide-pointer-policy={pointerPolicy}>
      {spotlight ? (
        <div className="md-guide-spotlight" aria-hidden="true" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height, borderRadius: spotlight.radius }} />
      ) : <div className="md-guide-dimmer" aria-hidden="true" />}
      {pointerPolicy === "block_background" ? <div className="md-guide-pointer-blocker" aria-hidden="true" /> : null}
      {pointerPolicy === "allow_target" ? blockers.map((rect, index) => <div key={index} className="md-guide-pointer-slice" aria-hidden="true" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />) : null}
      <div
        ref={surfaceRef}
        className="md-guide-surface"
        role={pointerPolicy === "block_background" ? "dialog" : "group"}
        aria-modal={pointerPolicy === "block_background" ? true : undefined}
        aria-label="إرشاد مَدار"
        tabIndex={-1}
        data-guide-placement={placement.placement}
        style={{ transform: `translate3d(${placement.x}px, ${placement.y}px, 0)`, maxWidth: Math.min(400, placement.maxWidth) }}
      >
        <div className="md-guide-surface-meta"><span>إرشاد مَدار</span><span>{currentIndex} / {total}</span></div>
        {step.content.title ? <h2>{step.content.title.defaultText}</h2> : null}
        <p>{step.content.message.defaultText}</p>
        {step.content.hint ? <small>{step.content.hint.defaultText}</small> : null}
        {resolution === "pending" ? <div className="md-guide-status">جارٍ تجهيز العنصر…</div> : null}
        {unavailable ? <div className="md-guide-status is-warning" role="status">تعذر الوصول إلى العنصر الآن. يمكنك المحاولة مجددًا دون إيقاف الجولة.</div> : null}
        <div className="md-guide-actions">
          {currentIndex > 1 ? <button type="button" className="md-button md-button-ghost md-button-sm" disabled={transitioning} onClick={() => void run(() => controller.previousStep())}>السابق</button> : null}
          {unavailable ? <button type="button" className="md-button md-button-secondary md-button-sm" disabled={transitioning} onClick={() => setRetryKey((value) => value + 1)}>إعادة المحاولة</button> : <button type="button" className="md-button md-button-primary md-button-sm" disabled={transitioning || resolution === "pending"} onClick={() => void run(() => controller.nextStep())}>{currentIndex >= total ? "إنهاء" : "التالي"}</button>}
          {step.target?.optional && unavailable ? <button type="button" className="md-button md-button-ghost md-button-sm" disabled={transitioning} onClick={() => void run(() => controller.nextStep())}>تجاوز الخطوة</button> : null}
          {guide.completion.allowSkip ? <button type="button" className="md-button md-button-ghost md-button-sm" disabled={transitioning} onClick={() => void run(() => controller.skipGuide())}>تخطي الجولة</button> : null}
          {guide.completion.allowDismiss ? <button type="button" className="md-guide-close" disabled={transitioning} onClick={() => void run(() => controller.dismissGuide())} aria-label="إغلاق الإرشاد">×</button> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
