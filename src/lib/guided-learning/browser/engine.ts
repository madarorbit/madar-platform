import type {
  GuideStep,
  GuideTargetId,
} from "../contracts";
import { GUIDE_TARGET_ATTRIBUTE } from "../targets";

export type GuideTargetResolutionState =
  | "pending"
  | "resolved"
  | "missing"
  | "hidden"
  | "detached"
  | "unavailable";

export type GuidePointerPolicy = "block_background" | "allow_target" | "allow_all";
export type GuideMissingTargetPolicy = "wait" | "skip_step" | "suspend" | "fail_guide";
export type GuidePhysicalPlacement = "top" | "bottom" | "left" | "right" | "center";

export type RectLike = Readonly<{
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}>;

export type GuideGeometry = RectLike & Readonly<{
  centerX: number;
  centerY: number;
}>;

export type GuideViewport = Readonly<{
  width: number;
  height: number;
  topInset?: number;
  rightInset?: number;
  bottomInset?: number;
  leftInset?: number;
}>;

export type GuideSpotlightGeometry = GuideGeometry & Readonly<{
  radius: number;
}>;

export type GuidePlacementResult = Readonly<{
  placement: GuidePhysicalPlacement;
  x: number;
  y: number;
  maxWidth: number;
}>;

export type GuideTargetResolution = Readonly<{
  state: Exclude<GuideTargetResolutionState, "pending">;
  id: GuideTargetId;
  element?: Element;
}>;

export type GuideTargetEnvironment = Readonly<{
  root?: ParentNode | null;
  getStyle?: (element: Element) => Pick<CSSStyleDeclaration, "display" | "visibility" | "opacity">;
  getRect?: (element: Element) => RectLike;
  isConnected?: (element: Element) => boolean;
}>;

const safeDocument = () => (typeof document === "undefined" ? null : document);
const safeWindow = () => (typeof window === "undefined" ? null : window);

const defaultGetStyle = (element: Element) => {
  const view = element.ownerDocument?.defaultView ?? safeWindow();
  return view?.getComputedStyle(element) ?? ({ display: "block", visibility: "visible", opacity: "1" } as CSSStyleDeclaration);
};

const defaultGetRect = (element: Element): RectLike => element.getBoundingClientRect();

export function targetSelector(id: GuideTargetId): string {
  return `[${GUIDE_TARGET_ATTRIBUTE}="${id}"]`;
}

export function resolveGuideTarget(
  id: GuideTargetId,
  environment: GuideTargetEnvironment = {},
): GuideTargetResolution {
  const root = environment.root === undefined ? safeDocument() : environment.root;
  if (!root || typeof root.querySelector !== "function") return { state: "unavailable", id };
  const element = root.querySelector(targetSelector(id));
  if (!element) return { state: "missing", id };
  const connected = environment.isConnected?.(element) ?? element.isConnected;
  if (!connected) return { state: "detached", id, element };
  const style = (environment.getStyle ?? defaultGetStyle)(element);
  const rect = (environment.getRect ?? defaultGetRect)(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number.parseFloat(style.opacity || "1") === 0 ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return { state: "hidden", id, element };
  }
  return { state: "resolved", id, element };
}

export async function waitForGuideTarget(
  ids: readonly GuideTargetId[],
  options: Readonly<{
    root?: ParentNode | null;
    timeoutMs?: number;
    signal?: AbortSignal;
    onState?: (state: GuideTargetResolutionState) => void;
  }> = {},
): Promise<GuideTargetResolution> {
  const root = options.root === undefined ? safeDocument() : options.root;
  const firstId = ids[0];
  if (!firstId || !root) return { state: "unavailable", id: firstId as GuideTargetId };

  const resolveCandidates = () => {
    let best: GuideTargetResolution | null = null;
    for (const id of ids) {
      const result = resolveGuideTarget(id, { root });
      if (result.state === "resolved") return result;
      if (!best || best.state === "missing") best = result;
    }
    return best ?? ({ state: "missing", id: firstId } as const);
  };

  const immediate = resolveCandidates();
  if (immediate.state === "resolved" || options.signal?.aborted) return immediate;
  if (typeof MutationObserver === "undefined") return immediate;

  options.onState?.("pending");
  const timeoutMs = Math.max(0, Math.min(options.timeoutMs ?? 1200, 5000));
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: GuideTargetResolution) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      options.onState?.(result.state);
      resolve(result);
    };
    const check = () => {
      const result = resolveCandidates();
      if (result.state === "resolved") finish(result);
    };
    const observer = new MutationObserver(check);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", GUIDE_TARGET_ATTRIBUTE],
    });
    const timer = setTimeout(() => finish(resolveCandidates()), timeoutMs);
    const abort = () => finish(resolveCandidates());
    options.signal?.addEventListener("abort", abort, { once: true });
    check();
  });
}

export function measureGuideTarget(
  element: Element,
  getRect: (element: Element) => RectLike = defaultGetRect,
): GuideGeometry {
  const rect = getRect(element);
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

export function computeSpotlightGeometry(
  target: RectLike,
  viewport: GuideViewport,
  options: Readonly<{ padding?: number; radius?: number }> = {},
): GuideSpotlightGeometry {
  const padding = Math.max(0, options.padding ?? 8);
  const minLeft = viewport.leftInset ?? 0;
  const minTop = viewport.topInset ?? 0;
  const maxRight = viewport.width - (viewport.rightInset ?? 0);
  const maxBottom = viewport.height - (viewport.bottomInset ?? 0);
  const left = Math.max(minLeft, target.left - padding);
  const top = Math.max(minTop, target.top - padding);
  const right = Math.min(maxRight, target.right + padding);
  const bottom = Math.min(maxBottom, target.bottom + padding);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return {
    top,
    left,
    right,
    bottom,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    radius: Math.min(Math.max(0, options.radius ?? 14), Math.min(width, height) / 2),
  };
}

export function inferTargetRadius(element: Element, fallback = 14): number {
  if (typeof window === "undefined") return fallback;
  const value = Number.parseFloat(window.getComputedStyle(element).borderTopLeftRadius || "");
  return Number.isFinite(value) ? value : fallback;
}

export function getGuideViewport(): GuideViewport {
  const view = safeWindow();
  if (!view) return { width: 0, height: 0 };
  const viewport = view.visualViewport;
  const width = viewport?.width ?? view.innerWidth;
  const height = viewport?.height ?? view.innerHeight;
  const documentRef = safeDocument();
  let topInset = 0;
  let bottomInset = 0;
  if (documentRef) {
    for (const element of documentRef.querySelectorAll<HTMLElement>("[data-madar-guide-occluder]")) {
      const style = view.getComputedStyle(element);
      if (style.display === "none" || (style.position !== "fixed" && style.position !== "sticky")) continue;
      const rect = element.getBoundingClientRect();
      const edge = element.dataset.madarGuideOccluder;
      if (edge === "top" && rect.top <= 1) topInset = Math.max(topInset, rect.bottom);
      if (edge === "bottom" && rect.bottom >= height - 1) bottomInset = Math.max(bottomInset, height - rect.top);
    }
  }
  return { width, height, topInset, bottomInset };
}

export function isGuideTargetVisible(
  rect: RectLike,
  viewport: GuideViewport,
  margin = 24,
): boolean {
  const top = (viewport.topInset ?? 0) + margin;
  const right = viewport.width - (viewport.rightInset ?? 0) - margin;
  const bottom = viewport.height - (viewport.bottomInset ?? 0) - margin;
  const left = (viewport.leftInset ?? 0) + margin;
  return rect.top >= top && rect.left >= left && rect.bottom <= bottom && rect.right <= right;
}

export async function scrollGuideTargetIntoView(
  element: Element,
  options: Readonly<{
    viewport?: GuideViewport;
    margin?: number;
    reducedMotion?: boolean;
    maxSettleMs?: number;
  }> = {},
): Promise<boolean> {
  const viewport = options.viewport ?? getGuideViewport();
  if (isGuideTargetVisible(element.getBoundingClientRect(), viewport, options.margin ?? 24)) return false;
  element.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: options.reducedMotion ? "auto" : "smooth",
  });
  await waitForTargetGeometryToSettle(element, options.maxSettleMs ?? (options.reducedMotion ? 80 : 500));
  return true;
}

export async function waitForTargetGeometryToSettle(element: Element, maxMs = 500): Promise<void> {
  if (typeof requestAnimationFrame === "undefined") return;
  const started = typeof performance === "undefined" ? Date.now() : performance.now();
  let last = element.getBoundingClientRect();
  let stableFrames = 0;
  await new Promise<void>((resolve) => {
    const frame = () => {
      if (!element.isConnected) return resolve();
      const next = element.getBoundingClientRect();
      const stable = Math.abs(next.top - last.top) < 0.5 && Math.abs(next.left - last.left) < 0.5;
      stableFrames = stable ? stableFrames + 1 : 0;
      last = next;
      const now = typeof performance === "undefined" ? Date.now() : performance.now();
      if (stableFrames >= 2 || now - started >= maxMs) return resolve();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

export function getScrollableAncestors(element: Element): readonly EventTarget[] {
  const result: EventTarget[] = [];
  let parent = element.parentElement;
  while (parent) {
    const style = parent.ownerDocument.defaultView?.getComputedStyle(parent);
    const overflow = `${style?.overflow ?? ""} ${style?.overflowX ?? ""} ${style?.overflowY ?? ""}`;
    if (/(auto|scroll|overlay)/.test(overflow) && (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth)) {
      result.push(parent);
    }
    parent = parent.parentElement;
  }
  const view = element.ownerDocument.defaultView;
  if (view) result.push(view);
  return result;
}

export function trackGuideTarget(
  element: Element,
  onChange: (state: GuideTargetResolutionState, geometry: GuideGeometry | null) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let raf = 0;
  let stopped = false;
  const measure = () => {
    raf = 0;
    if (stopped) return;
    if (!element.isConnected) {
      onChange("detached", null);
      return;
    }
    const result = resolveGuideTarget((element.getAttribute(GUIDE_TARGET_ATTRIBUTE) || "invalid.target") as GuideTargetId, {
      root: element.ownerDocument,
    });
    if (result.state !== "resolved") {
      onChange(result.state, null);
      return;
    }
    onChange("resolved", measureGuideTarget(element));
  };
  const schedule = () => {
    if (!raf && !stopped) raf = window.requestAnimationFrame(measure);
  };
  const scrollTargets = getScrollableAncestors(element);
  scrollTargets.forEach((target) => target.addEventListener("scroll", schedule, { passive: true }));
  window.addEventListener("resize", schedule, { passive: true });
  const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  resizeObserver?.observe(element);
  const parent = element.parentElement;
  const detachObserver = parent && typeof MutationObserver !== "undefined"
    ? new MutationObserver(schedule)
    : null;
  detachObserver?.observe(parent, { childList: true, subtree: true });
  schedule();
  return () => {
    stopped = true;
    if (raf) window.cancelAnimationFrame(raf);
    scrollTargets.forEach((target) => target.removeEventListener("scroll", schedule));
    window.removeEventListener("resize", schedule);
    resizeObserver?.disconnect();
    detachObserver?.disconnect();
  };
}

export function pointerPolicyForStep(step: GuideStep): GuidePointerPolicy {
  if (step.interaction.mode === "user_action") return "allow_target";
  if (step.interaction.mode === "automatic") return "allow_all";
  return "block_background";
}

export function missingTargetPolicyForStep(step: GuideStep): GuideMissingTargetPolicy {
  if (step.target?.optional) return "skip_step";
  if (step.route?.waitForTarget) return "suspend";
  return "wait";
}

export function resolveLogicalPlacement(
  requested: GuideStep["placementHint"],
  direction: "rtl" | "ltr",
): "top" | "bottom" | "left" | "right" | "center" | "auto" {
  if (requested === "start") return direction === "rtl" ? "right" : "left";
  if (requested === "end") return direction === "rtl" ? "left" : "right";
  return requested ?? "auto";
}

export function computeGuidePlacement(input: Readonly<{
  target?: RectLike | null;
  viewport: GuideViewport;
  surface: Readonly<{ width: number; height: number }>;
  requested?: GuideStep["placementHint"];
  direction: "rtl" | "ltr";
  gap?: number;
  margin?: number;
}>): GuidePlacementResult {
  const margin = Math.max(8, input.margin ?? 16);
  const gap = Math.max(4, input.gap ?? 16);
  const viewportLeft = (input.viewport.leftInset ?? 0) + margin;
  const viewportTop = (input.viewport.topInset ?? 0) + margin;
  const viewportRight = input.viewport.width - (input.viewport.rightInset ?? 0) - margin;
  const viewportBottom = input.viewport.height - (input.viewport.bottomInset ?? 0) - margin;
  const maxWidth = Math.max(0, viewportRight - viewportLeft);
  if (!input.target) {
    return {
      placement: "center",
      x: Math.max(viewportLeft, (input.viewport.width - input.surface.width) / 2),
      y: Math.max(viewportTop, (input.viewport.height - input.surface.height) / 2),
      maxWidth,
    };
  }

  const target = input.target;
  const spaces = {
    top: target.top - viewportTop,
    bottom: viewportBottom - target.bottom,
    left: target.left - viewportLeft,
    right: viewportRight - target.right,
  };
  let requested = resolveLogicalPlacement(input.requested, input.direction);
  if (requested === "auto") {
    const candidates: Array<[GuidePhysicalPlacement, number, number]> = [
      ["bottom", spaces.bottom, input.surface.height],
      ["top", spaces.top, input.surface.height],
      ["right", spaces.right, input.surface.width],
      ["left", spaces.left, input.surface.width],
    ];
    requested = (candidates.find(([, available, needed]) => available >= needed + gap)
      ?? [...candidates].sort((a, b) => b[1] - a[1])[0])[0];
  }

  const clampX = (value: number) => Math.min(Math.max(value, viewportLeft), Math.max(viewportLeft, viewportRight - input.surface.width));
  const clampY = (value: number) => Math.min(Math.max(value, viewportTop), Math.max(viewportTop, viewportBottom - input.surface.height));
  if (requested === "top") {
    return { placement: "top", x: clampX(target.left + (target.width - input.surface.width) / 2), y: clampY(target.top - input.surface.height - gap), maxWidth };
  }
  if (requested === "bottom") {
    return { placement: "bottom", x: clampX(target.left + (target.width - input.surface.width) / 2), y: clampY(target.bottom + gap), maxWidth };
  }
  if (requested === "left") {
    return { placement: "left", x: clampX(target.left - input.surface.width - gap), y: clampY(target.top + (target.height - input.surface.height) / 2), maxWidth };
  }
  if (requested === "right") {
    return { placement: "right", x: clampX(target.right + gap), y: clampY(target.top + (target.height - input.surface.height) / 2), maxWidth };
  }
  return { placement: "center", x: clampX((input.viewport.width - input.surface.width) / 2), y: clampY((input.viewport.height - input.surface.height) / 2), maxWidth };
}

export function computeCutoutBlockers(
  cutout: RectLike,
  viewport: GuideViewport,
): readonly RectLike[] {
  const top = Math.max(0, cutout.top);
  const bottom = Math.min(viewport.height, cutout.bottom);
  const left = Math.max(0, cutout.left);
  const right = Math.min(viewport.width, cutout.right);
  return [
    { top: 0, left: 0, right: viewport.width, bottom: top, width: viewport.width, height: top },
    { top: bottom, left: 0, right: viewport.width, bottom: viewport.height, width: viewport.width, height: Math.max(0, viewport.height - bottom) },
    { top, left: 0, right: left, bottom, width: left, height: Math.max(0, bottom - top) },
    { top, left: right, right: viewport.width, bottom, width: Math.max(0, viewport.width - right), height: Math.max(0, bottom - top) },
  ].filter((rect) => rect.width > 0 && rect.height > 0);
}
