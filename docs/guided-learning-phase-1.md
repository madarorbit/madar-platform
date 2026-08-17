# MADAR ORBY Guided Learning System — Phase 1.0

## Purpose

Phase 1 defines the architecture and contracts for MADAR's contextual guided-learning system. It intentionally does **not** render tours, overlays, spotlights, ORBY motion, production onboarding content, or persistent learning data.

The core rule is:

> Guided Learning observes MADAR product state; it does not own MADAR product state.

The engine therefore consumes authenticated identity, route, workspace/service state, permissions, subscriptions, and feature availability through `GuidedLearningContext`. It does not create a second auth/session/workspace model.

## Existing MADAR boundaries inspected

- The application root (`app/layout.tsx`) contains public/global presentation such as navigation, status, cart, theme, analytics script, and the floating ORBY entry. It also serves public and auth routes, so Guided Learning must **not** be mounted there globally.
- Authenticated account routes are protected in `app/account/layout.tsx`, which resolves MADAR identity and renders `AccountShell`.
- `AccountShell` delegates to the canonical client-side `MadarGlobalShell`, which already spans account navigation and service/workspace switching.
- Stable identity comes from the existing Supabase-backed shell identity (`getOptionalShellIdentity`); Phase 1 does not create an identity of its own.
- Retail currently has `/retail/onboarding`, but it is business/workspace setup backed by `retail_onboarding_drafts`, not a product-tour/coach-mark system. It remains untouched.
- Legacy `/account/setup` only redirects to `/account/services`.
- No guided-learning progress table exists in the primary MADAR Supabase schema. Existing ORBY conversation/memory tables and Retail onboarding drafts are not repurposed.
- Google Analytics exists at the root, but Phase 1 only defines privacy-safe learning event contracts; it does not wire a production analytics provider.

### Future runtime mount boundary

The preferred production mount point is the **authenticated application shell boundary**, not `RootLayout`.

Phase 2+ should add a small provider/controller around the authenticated shell(s) that need cross-route learning. For account and workspace/service surfaces this should sit at, or immediately above, the canonical `MadarGlobalShell` after existing identity/context has been resolved. The provider can then survive page navigation while avoiding public landing pages and authentication routes.

Phase 1 deliberately does not mount a provider, so there is no new runtime cost on production pages yet.

## Architecture

```text
MADAR Guided Learning
        ↓
Guide Registry
        ↓
Guide Definitions
        ↓
Trigger / Eligibility contracts
        ↓
Journey
        ↓
Steps
        ↓
Stable Targets
        ↓
Runtime Engine
        ↓
LearningProgressStore
```

Responsibilities are intentionally separated:

- **Definitions** — what a guide teaches and the semantic instructions it needs.
- **Runtime** — the current foreground guide, journey, step, and lifecycle transitions.
- **Persistence** — account-scoped progress through `LearningProgressStore`.
- **UI** — future overlay/spotlight/ORBY rendering. No UI exists in Phase 1.

Adding a guide should not require changing the runtime, router, provider, database adapter, or ORBY component.

## Core concepts

### Guide

A registered, versioned learning unit. A `GuideDefinition` contains:

- stable `id`
- `version` and `revision`
- typed `type` and `scope`
- trigger and optional eligibility descriptors
- priority
- one or more journeys
- completion, replay, and update policies

### Journey

A path through a guide. Phase 1 fixtures use one journey, but `GuideDefinition.journeys` and `defaultJourneyId` allow future alternate journeys without redesigning the core contract.

### Step

A semantic learning unit. `GuideStep` supports:

- explanations and region guidance
- informational steps without targets
- user-action steps
- navigation steps across routes
- completion steps
- optional stable target references
- route hints
- presentation placement hints
- semantic ORBY character intent
- passive/manual/action/navigation/automatic interaction modes

These are contracts only; Phase 1 does not implement their visual or interaction behavior.

### Target

A UI target is addressed by a stable hierarchical ID, never by a brittle DOM selector.

Canonical DOM attribute:

```text
data-madar-guide="global.navigation.notifications"
```

Naming convention:

```text
domain.area[.element...]
```

Rules:

- lowercase only
- each segment starts with a letter
- letters, digits, and hyphens are allowed within segments
- at least two dot-separated segments
- do not encode `nth-child`, DOM ancestry, generated class names, database row IDs, or user data

Examples:

```text
global.account-menu
global.notifications
orby.composer
retail.overview.primary-kpis
retail.products.create
```

(`global.notifications` and `orby.composer` are valid two-segment IDs; deeper IDs are preferred when the domain needs disambiguation.)

Use `defineGuideTargetId()` to validate IDs and `guideTargetProps()` to produce the canonical attribute. `GuideTargetRegistry` detects duplicate declarations. Phase 1 does not annotate production UI en masse.

## Guide taxonomy

Built-in guide types:

- `platform_onboarding`
- `service_onboarding`
- `page_guidance`
- `feature_discovery`
- `contextual_tip`
- `interactive_action`
- `manual_tour`

Namespaced `custom:*` types are allowed for future extension without scattering untyped strings through runtime code.

Scopes:

- `platform`
- `account`
- `orby`
- `service`
- `workspace`
- `page`
- `feature`

## Trigger and eligibility contracts

Trigger variants cover:

- first platform visit
- first service access
- first page visit
- feature introduced
- manual replay
- explicit user request
- contextual condition key

Eligibility is declarative (`authenticated`, route, service, permission, feature, or namespaced custom rule). Phase 1 does not contain the contextual decision engine; Phase 4 can evaluate these descriptors against `GuidedLearningContext` without changing guide definitions.

## Arabic-first ORBY content

`GuideText` requires:

```text
defaultLocale: "ar"
defaultText: <Arabic authoritative content>
```

An optional `messageKey` lets the future renderer resolve the same content through MADAR's localization layer. Runtime never contains tour copy.

`OrbyGuideMessage` supports optional title, message, hint, primary CTA, and secondary CTA. It is presentation-neutral.

## ORBY character contract

A step may request a semantic character intent:

- `idle`
- `point`
- `attention`
- `confirm`
- `celebrate`
- `thinking`
- namespaced `custom:*`

An optional semantic direction may be `up`, `down`, `left`, `right`, or `target`.

The contract never references GIF, Rive, Lottie, CSS animation, image files, or coordinates. Phase 3 can map semantic intent to its chosen visual implementation without changing definitions or runtime.

## Progress model

Official statuses:

- `not_started`
- `in_progress`
- `completed`
- `skipped`
- `dismissed`

`skipped` means the user chose to skip a guide/path. `dismissed` means the user closed optional/contextual guidance. Neither implies completion.

Progress can record:

- current step
- guide version
- started/completed/skipped/dismissed/last-seen timestamps
- current run mode
- completion history

An interrupted/paused runtime remains `in_progress`; pause is a runtime lifecycle state, not a false completion status.

## Persistence abstraction

`LearningProgressStore` is the only persistence dependency of the runtime:

```text
getProgress(subject, guideId)
saveProgress(subject, progress)
resetProgress(subject, guideId)
```

`LearningProgressSubject` is account-scoped. The authenticated MADAR shell must supply the stable account identity; Guided Learning never invents browser-only identity.

Phase 1 ships `MemoryLearningProgressStore` for tests/dev proof only. It has no browser-storage dependency. Phase 5 can replace it with a Supabase-backed adapter using the existing MADAR account identity without modifying `GuidedLearningRuntime`.

## Versioning rules

Guide versioning has two dimensions:

### `version`

The **learning version**. Increment this only when the learning contract changes enough that progress policy may need reconsideration.

### `revision`

The **content/implementation revision**. Increment for copy edits, target refinements, metadata changes, and implementation maintenance that should not make users repeat learning.

A version increase alone does not dictate replay. `updatePolicy` explicitly states intended future behavior:

- `preserve_completion`
- `full_replay`
- `new_steps_only`
- `optional_update`

Phase 5/6 can apply these policies when persistent historical versions exist. This prevents the naïve rule `version changed => replay everything`.

## Replay semantics

`startGuide(id, { mode: "replay" })` may run an already-completed guide if its replay policy allows it.

Completion history is preserved during replay. Starting replay changes the current run to `in_progress`, but does not delete historical completion records. Completing replay appends a replay completion record.

Normal `startGuide` refuses to silently restart a completed guide; callers must explicitly use replay mode.

## Runtime lifecycle

Runtime phases:

```text
idle
  → eligible
  → starting
  → active
      → paused → active
      → completed
      → skipped
      → dismissed
      → failed
```

Progress and runtime state are distinct. The runtime uses explicit phases rather than boolean flags such as `isOpen`, `tourDone`, or `wasShown`.

Core operations:

- `markEligible()`
- `startGuide()`
- `nextStep()` / `previousStep()`
- `pauseGuide()` / `resumeGuide()`
- `restoreGuide()` after runtime recreation
- `completeGuide()`
- `skipGuide()`
- `dismissGuide()`
- `resetGuide()`

Only one foreground guide session may own the runtime at once. Starting another active/paused/starting guide produces a typed `guide_conflict` error.

Because the runtime is a plain service rather than component-local state, it can be hosted by a future authenticated provider across route changes. `restoreGuide()` can reconstruct the correct step from persisted progress after a provider/runtime recreation.

## Priority and conflicts

Default priority tiers are deterministic:

1. critical contextual override — `500`
2. service onboarding — `400`
3. platform onboarding — `300`
4. page/interactive guidance — `250`
5. feature discovery — `200`
6. contextual tip — `100`
7. manual/default — `50`

A guide may declare an explicit numeric priority when product semantics require it. Equal priority is resolved deterministically by guide ID, never registration timing or render timing.

Phase 4 will decide which definitions are actually eligible; Phase 1 only provides deterministic arbitration once candidates are known.

## Analytics / observability contract

Typed events:

- `guide_started`
- `guide_step_viewed`
- `guide_step_completed`
- `guide_skipped`
- `guide_dismissed`
- `guide_completed`
- `guide_replayed`
- `guide_failed`

Payloads contain technical guide/version/step/run/error identifiers only. They must not contain ORBY message text, customer/business data, tokens, private profile fields, or arbitrary context snapshots.

`GuidedLearningEventSink` is provider-neutral. The default runtime sink is a no-op. Phase 8 can connect the contract to the approved observability stack.

## Error model

Typed error codes include:

- `guide_not_found`
- `duplicate_guide`
- `invalid_definition`
- `invalid_step`
- `invalid_route`
- `invalid_target`
- `duplicate_target`
- `progress_load_failed`
- `progress_write_failed`
- `guide_conflict`
- `guide_already_completed`
- `replay_not_allowed`
- `invalid_runtime_transition`

Runtime errors are not collapsed into generic `console.error("Tour failed")` messages.

## Adding a future guide

1. Create a typed `GuideDefinition`.
2. Validate/register it in the central `GuideRegistry` composition layer.
3. Declare only the stable target IDs that the guide needs.
4. Add Arabic-authoritative content/localization keys.
5. Add contract/lifecycle tests.

A new guide should not require editing the runtime, router, modal/overlay implementation, database query layer, ORBY component, or auth logic.

## Phase 1 fixture

`phase-1-foundation-fixture` contains three tiny steps and exists only under the Guided Learning testing namespace. Production application code does not import or register it.

It proves registry, validation, stable targets, runtime lifecycle, account-scoped in-memory progress, pause/restore capability, priority, and replay history.

## Intentionally not implemented in Phase 1

- screen dimming, overlay, cutout, spotlight, glow, or target positioning — Phase 2
- ORBY character animation/assets/motion mapping — Phase 3
- contextual intelligence / eligibility decision engine — Phase 4
- Supabase/account persistent learning memory and cross-device synchronization — Phase 5
- production Platform/Retail/Connected/Native/ORBY guides — Phase 6
- final mobile/adaptive behavior and visual polish — Phase 7
- production analytics/observability wiring — Phase 8
- Learning Hub, Demo Workspace, Demo Data — separate system/out of this phase

Phase 1 is successful only if those layers can be added without redesigning these core responsibilities.
