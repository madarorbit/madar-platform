# MADAR ORBY Guided Learning — Phase 2.0

## Purpose
Phase 2 adds the browser/UI engine above the Phase 1 contracts. The separation remains `Definitions != Runtime != Persistence != UI`.

```text
Phase 1 Runtime -> UI Controller -> Active Step -> Target Resolver -> Geometry/Tracking -> Spotlight -> Positioning -> GuidedLearningHost
```

No ORBY character/motion, persistent progress, contextual intelligence, production tours, Learning Hub, or demo workspace is implemented here.

## Mount boundary
`GuidedLearningBoundary` is mounted only on authenticated Account, business Workspace, Retail Workspace, and authenticated ORBY surfaces. Public/guest routes do not mount it. It receives the existing stable MADAR account identity; no auth/session/browser identity is created. Its app-root wrapper uses `display: contents`, so it causes no layout shift.

The production registry is empty. The Phase 2 fixture is test-only and therefore no real user receives a demo guide.

## Runtime integration
`GuidedLearningController` is a thin adapter over the Phase 1 `GuidedLearningRuntime` and `GuideRegistry`. It stores no parallel guide state: snapshots are derived from `runtime.getState()` and registered definitions. UI operations delegate to the Phase 1 runtime.

## Target resolution
Targets continue to use stable IDs through `data-madar-guide="domain.area.element"`. `resolveGuideTarget()` distinguishes `resolved`, `missing`, `hidden`, `detached`, and `unavailable`; `waitForGuideTarget()` adds `pending` while waiting for delayed rendering.

Waiting performs an immediate lookup and, only when needed, creates one scoped temporary `MutationObserver`. It is abortable, bounded to a hard maximum of 5 seconds, and always disconnected. There is no polling or permanent DOM scan. The resolver accepts ordered candidate IDs so future responsive fallbacks can reuse the same engine.

## Geometry and scrolling
`measureGuideTarget()` centralizes `getBoundingClientRect()` into top/left/right/bottom/width/height/centerX/centerY. `computeSpotlightGeometry()` applies padding/radius and viewport clamping.

Offscreen targets are checked before painting final geometry. Native `scrollIntoView({block:"center", inline:"nearest"})` is used so nested scroll containers participate naturally; the engine waits for geometry to settle, then remeasures. Reduced-motion users get immediate scrolling. Viewport contracts support fixed/sticky top/bottom insets; ORBY exposes its header as an explicit guide occluder.

## Tracking
Tracking exists only for a resolved active target. It uses passive listeners on scrollable ancestors/window, RAF throttling, a target-only `ResizeObserver`, and a scoped parent `MutationObserver` for detachment. Every listener/observer is removed on cleanup. Hidden/detached targets immediately clear stale spotlight geometry.

## Spotlight and overlay
The cutout is a transparent fixed rectangle with a `100vmax` semantic `box-shadow` using `--md-backdrop`. This provides rounded geometry and smooth x/y/width/height/radius transitions without depending on CSS-mask pointer hit-testing. MADAR semantic mint/accent/surface/border/shadow/motion tokens are used; no raw Phase 2 palette is introduced. The guide sits above normal modal content and below the toast/system layer.

## Pointer policy
Visual dimming and pointer interception are separate:
- `block_background`: one full-screen transparent blocker.
- `allow_target`: four blockers surround the cutout, leaving the real target clickable.
- `allow_all`: no blocker.

Current defaults derive from Phase 1 interaction mode: `user_action -> allow_target`, `automatic -> allow_all`, others -> blocking. Phase 1 contracts remain unchanged.

## Positioning and RTL
`computeGuidePlacement()` is pure and supports top/bottom/left/right/center/auto plus logical `start/end`. In RTL, `start` maps to physical right and `end` to left. Auto placement tests available space and clamps the surface to safe viewport margins. The API accepts explicit surface dimensions so Phase 3 can pass ORBY character/message footprint without changing the engine.

## Accessibility
Blocking steps temporarily make the authenticated app root `inert` and `aria-hidden` while the portal surface remains outside it. The temporary surface uses dialog semantics, receives focus, traps Tab within its controls, supports Escape, and restores prior focus on exit. Interactive target steps do not inert the app or aggressively steal focus. Reduced-motion CSS collapses transitions.

## Hydration/performance
DOM work is client-only and the portal is created only after mount; no permanent portal root is added. When no guide is active there is no overlay, MutationObserver, ResizeObserver, scroll/resize/keyboard listener, polling, or target scan. Public pages do not mount the boundary at all.

## Test fixture
`phase-2-engine-fixture` contains only three test/dev steps: visible target, offscreen interactive target, and optional dynamic target. Production code never registers it.

## Phase 3 extension point
Phase 3 should replace/extend only the temporary guide surface using existing target geometry, spotlight geometry, placement, active message, pointer policy, and Phase 1 semantic character intent. It must not require rewriting resolver, tracking, spotlight, positioning, or core runtime.

## Deferred intentionally
Phase 3: ORBY character/motion. Phase 4: contextual intelligence. Phase 5: Supabase learning memory. Phase 6: real tours/target coverage. Phase 7: final adaptive polish. Phase 8: production observability. Learning Hub/Demo Experience remain a separate system.
