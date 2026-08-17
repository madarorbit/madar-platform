# MADAR ORBY Guided Learning — Phase 3

## Status

- Phase 3B runtime integration: implemented.
- Phase 3A production rig authoring: blocked until a genuine layered/rigged ORBY asset can be authored.
- Phase 3 overall must not be marked closed while the rig is missing.

## Asset audit and rigging gate

The authoritative repository asset is `public/brand/orby-assistant.svg` at a 256×256 viewBox. Despite its `.svg` extension, it is a container around a single embedded WebP raster image. It is not a layered vector drawing, sprite sheet, Lottie animation, Rive artboard, or bone/mesh rig.

Repository and dependency inspection found no `.riv`, Rive dependency, Lottie runtime, Bodymovin source, layered ORBY source, or existing character state machine. Adding a Rive runtime without a real `.riv` asset would add bundle cost without producing real character animation, so Phase 3 intentionally does not do that.

The static authoritative ORBY image remains the honest technical fallback. It is not translated, rotated, bounced, warped, or scaled as a fake substitute for skeletal motion.

## Phase 3B architecture

```text
Phase 1 Guide Runtime
  → active GuideStep.character semantic request
  → Phase 2 target state + placement
  → Phase 3 intent adapter
  → ORBYCharacterRuntime semantic sequencer
  → ORBYCharacterDriver boundary
  → ORBY + conversational message presentation
```

Phase 3 never resolves DOM targets and never recomputes placement. `computeGuidePlacement()` remains the only placement engine. The complete ORBY + message surface is measured by the existing Phase 2 `ResizeObserver`, then that measured footprint is passed back into the Phase 2 positioning engine.

## Semantic motion contract

The technology-neutral character layer supports:

- `idle`
- `enter`
- `exit`
- `look`
- `point`
- `attention`
- `confirm`
- `celebrate`
- `thinking`
- `waiting`

Phase 1 built-in intents map directly where possible. Unknown future `custom:*` intents safely degrade to `idle` until a driver explicitly supports them.

A `point` request is planned as `look → point` rather than snapping directly. The semantic sequencer uses a monotonically increasing sequence token and cancels old scheduled stages, so rapid A → B → C step changes cannot leave a stale point direction queued behind the current step.

Target states other than `resolved` map to `waiting/neutral`; ORBY never points into an unavailable target location.

## Direction and RTL

Directions exposed to the character driver are logical:

- `up`
- `down`
- `inline-start`
- `inline-end`
- `target`
- `neutral`

Phase 2 returns the physical presentation placement. Phase 3 inverts that relationship to determine where the target is relative to ORBY. Example: if the presentation is to the right of the target, ORBY points physically left. In RTL that is `inline-end`; in LTR it is `inline-start`.

Every motion frame also carries `layoutDirection: rtl | ltr`, so a future Rive driver can resolve logical direction without querying `document.dir` itself.

## Reduced motion

With `prefers-reduced-motion: reduce`:

- multi-stage flourish is removed;
- point remains a semantically understandable still point pose request;
- continuous character sway is not required;
- overall Phase 2 movement transitions are already reduced;
- the guide remains understandable from message, spotlight, and controls alone.

## ORBY message presentation

The generic Phase 2 panel is replaced by a single ORBY presentation composition:

- authoritative ORBY identity;
- compact conversational message card;
- Arabic-first title/message/hint;
- progress indicator;
- existing Previous/Next/Skip/Dismiss controls;
- controlled target-unavailable status;
- responsive compact composition on narrow screens.

The character image is decorative to assistive technology; the message and controls are the semantic content. Existing Phase 2 dialog/group semantics, focus trap, Escape handling, `inert` behavior, and click-through pointer policies remain authoritative.

## Performance and loading

`ORBYGuidePresentation` is lazy-loaded and rendered only while a guide is active. The production guide registry remains empty, so no user receives a demo journey automatically.

`ORBYCharacterRuntime` is a small semantic coordinator and has no frame loop. A future animation driver is requested only on the first active presentation. Driver loading failure is classified as `fallback` and leaves spotlight, message, controls, and static ORBY usable.

The driver contract also exposes document visibility so a real animation implementation can pause its renderer while the document is hidden.

## Completion semantics

Only real guide completion may request `celebrate`. Dismiss and Skip request `exit` directly and never imply successful completion. Terminal presentation delay is deliberately short and bounded; guide cleanup never waits on a long animation.

## Fixture safety

`phase-3-orby-presentation-fixture.ts` is test/dev-only. Production boundary code does not import or register it. Real Platform/Retail/Connected/Native/ORBY journeys remain Phase 6 work.

## Phase 3A blocker

A professional character rig cannot be truthfully authored from the current flat raster inside this repository/tooling alone. The exact handoff contract for the required production rig lives in `docs/orby-guided-learning-rig-contract.md`.
