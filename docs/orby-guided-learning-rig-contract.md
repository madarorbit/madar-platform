# ORBY Guided Learning — Production Rig Contract

This contract is the Phase 3A handoff for a professional animator/Rive author. It preserves the existing ORBY identity and plugs into the Phase 3B driver boundary without changing Guide Definitions, Phase 1 runtime, or Phase 2 targeting/placement.

## 1. Authoritative source

- Source: `public/brand/orby-assistant.svg`.
- Source canvas/viewBox: `0 0 256 256`.
- The file currently contains one embedded WebP raster image; it is not layered artwork.
- The animator must use the visible source pixels as the identity reference. No redraw, face redesign, recoloring, hand replacement, body-proportion change, AI regeneration, or stylistic reinterpretation.

## 2. Non-destructive source preparation

Create a high-fidelity layered working file by masking/segmenting the authoritative source only. Any newly revealed pixels needed behind an overlapping limb must be reconstructed conservatively from adjacent source geometry and reviewed against the original; do not invent a new silhouette.

Required separable regions where the source anatomy supports them:

- character/root silhouette;
- central body/core;
- face/display region as a protected region;
- left arm/forearm/hand;
- right arm/forearm/hand;
- any independently visible shoulder/upper-arm region required for clean deformation.

If the source does not contain enough information to separate a region without inventing appearance, stop and request an approved layered source rather than hallucinating hidden anatomy.

## 3. Artboard and coordinate system

- Rive artboard name: `ORBY_Guide`.
- Preserve the original square aspect ratio.
- Recommended authoring artboard: 512×512 logical units for comfortable mesh work, with source composition scaled uniformly from the 256×256 reference.
- Character origin: visual body center at the neutral pose.
- Preserve transparent edges; no baked background.
- Keep enough transparent safe area for modest hand extensions without clipping.

Do not hard-code browser pixels into the rig. Browser footprint is controlled by the Phase 2/3 presentation layer.

## 4. Pivot and bone hierarchy

Exact pivot coordinates must be set by the animator from the approved source; do not infer numeric pivots from this document.

Required hierarchy where anatomy permits:

```text
root
└─ body/core
   ├─ head-or-face-orientation control (only if separable without face warp)
   ├─ arm_start
   │  └─ elbow_start
   │     └─ wrist_start
   │        └─ hand_start
   └─ arm_end
      └─ elbow_end
         └─ wrist_end
            └─ hand_end
```

`start/end` names are logical, not permanently left/right. The runtime supplies both semantic direction and layout direction.

## 5. Mesh and deformation rules

- Use minimal mesh density needed for smooth bends.
- Prioritize shoulder/elbow/wrist transitions.
- Protect hand silhouette and finger shapes from stretching.
- Face/display pixels must not be warped as part of body lean unless specifically approved.
- No mesh tearing, visible seams, edge halos, texture swimming, or interpolation gaps.
- Keep torso/body deformation subtle; most guided motion should come from coordinated orientation and one arm.

## 6. State machine

Required Rive state machine name:

`GuidedLearning`

The React/driver layer will map technology-neutral Phase 3 frames into Rive inputs. Guide Definitions never reference these input names.

Recommended inputs:

- `intent` — Number enum.
- `direction` — Number enum.
- `layout_rtl` — Boolean.
- `active` — Boolean.
- `reduced_motion` — Boolean.

Suggested internal `intent` enum:

0. idle
1. enter
2. exit
3. look
4. point
5. attention
6. confirm
7. celebrate
8. thinking
9. waiting

Suggested internal `direction` enum:

0. neutral
1. up
2. down
3. inline-start
4. inline-end
5. target

The concrete numeric values are an implementation contract between the final Rive driver and the exported `.riv`; they must be documented beside the driver. They must never leak into Guide Definitions.

## 7. Required motion states

### idle
- Loop: yes.
- Duration: approximately 3–5 s per subtle cycle.
- Very small breathing/body settling; occasional minimal head/orientation adjustment.
- No bounce loop.

### enter
- Loop: no.
- Duration target: 180–260 ms.
- Soft appearance/settle; no large flight across the viewport.

### exit
- Loop: no.
- Duration target: 140–220 ms.
- Short release and disappearance-safe settle.

### look
- Loop: no/held end pose.
- Duration target: 80–140 ms.
- Eyes/head/body orientation first where source anatomy allows it.

### point
- Loop: no; hold the final pose until intent changes.
- Duration target after look: 160–260 ms.
- Small anticipation → body lean → arm → hand settle.
- Direction variants: up, down, inline-start, inline-end.

### attention
- Loop: no.
- Duration target: 150–220 ms.
- Small forward/lift emphasis only; no shake or flash.

### confirm
- Loop: no.
- Duration target: 120–180 ms.
- Soft nod/brief hand confirmation.

### celebrate
- Loop: no.
- Duration target: 300–450 ms.
- Reserved for actual guide completion. Warm and restrained, then settle/exit.

### thinking
- Loop: yes while requested.
- Slow, calm cycle; no spinner-like movement.

### waiting
- Loop: yes while requested.
- Near-idle state with subtle attentive hold; must not point at a missing target.

## 8. Direction behavior

The Phase 3 semantic frame provides:

- `direction`: `neutral | up | down | inline-start | inline-end | target`;
- `layoutDirection`: `rtl | ltr`.

The driver/state machine must resolve logical inline directions correctly. `inline-start` is physically right in RTL and left in LTR; `inline-end` is the inverse.

Point changes should blend cleanly. If the target moves but the semantic direction remains the same, do not restart the point animation; the browser presentation can reposition while the rig holds its pose.

## 9. Interruptibility

All one-shot motions must be interruptible by a new intent. No state may require waiting for a loop or full clip before accepting a new Step.

A rapid `A → B → C` sequence must end in C with no queued B point or stale direction.

## 10. Reduced motion

When `reduced_motion = true`:

- disable idle/thinking/waiting continuous flourish;
- use stable final semantic poses;
- point may be a static directional pose;
- enter/exit should be immediate or near-immediate;
- understanding must never depend on animation.

## 11. Visibility and lifecycle

The final driver will pause the Rive renderer when `document.hidden` and resume without replaying completed semantic transitions unnecessarily.

When no guide is active:

- no canvas renderer;
- no active animation loop;
- no loaded driver requirement unless already cached by the browser;
- release driver resources on guide-host disposal.

## 12. Export

Expected production asset path after approval:

`public/brand/orby-guided-learning.riv`

Requirements:

- deterministic state machine name/input contract;
- no external network dependencies;
- cacheable static asset;
- no embedded unrelated artboards/animations;
- target file size ≤ 500 KB where practical; review is required above 1 MB rather than sacrificing fidelity blindly.

## 13. Quality gate

A `.riv` is accepted only after visual QA confirms:

- ORBY is recognizably identical to the authoritative source at rest;
- no face/display warping;
- no hand/finger distortion;
- no mesh tearing or seam exposure;
- no halo/transparent-edge artifacts in light or dark UI;
- clean transitions with no snapping;
- restrained idle motion;
- readable directional point in RTL and LTR;
- clean rendering at compact mobile and medium desktop footprints;
- reduced-motion mode contains no continuous decorative animation.

Until an asset passes this gate, MADAR must continue using the static authoritative ORBY fallback and Phase 3.0 remains not closed.
