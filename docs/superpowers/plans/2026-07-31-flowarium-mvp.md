# Flowarium MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the documented Chrome Manifest V3 MVP for creating local focus Workflows, executing durable Sessions, using local Assets and Reward Dice, and importing or exporting data.

**Architecture:** A WXT extension organized into `workflow`, `session`, `assets` and `settings` features. Application-owned ports isolate Domain behavior from Dexie, Chrome APIs and React; thin WXT entry points compose adapters and use cases. The background service worker is the authoritative Session coordinator, with timestamp-derived timing and typed cross-context messages.

**Tech Stack:** TypeScript strict mode, WXT, Vite, React 19, Tailwind CSS 4, Zustand, Dexie/IndexedDB, `chrome.storage.local`, Vitest, React Testing Library, Playwright, ESLint, Prettier and pnpm.

## Global Constraints

- Target current stable Chrome with Manifest V3; request no host permissions.
- MVP surfaces are side panel, options page, background service worker and full-page focus view; do not add popup or content scripts.
- Domain and Application must not import React, WXT, Chrome APIs, Zustand, Dexie or storage records.
- Application owns ports; Infrastructure implements them; `src/app` performs composition.
- Initial features are `workflow`, `session`, `assets` and `settings` only.
- Directories use kebab-case. Primary-symbol filenames match PascalCase exports; function and utility filenames use camelCase.
- TypeScript strictness must not be weakened and `any` must not be introduced.
- Runtime data is `unknown` until validated at a boundary.
- Follow TDD: failing test, minimal implementation, passing test, refactor, full milestone gates.
- After every task run type checking, linting and relevant tests, then review the diff before committing.

---

### Task 1: Repository Foundation and Enforced Boundaries

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `wxt.config.ts`, `eslint.config.js`, `.prettierrc.json`
- Create: `entrypoints/background.ts`, `entrypoints/sidepanel/index.html`, `entrypoints/sidepanel/main.tsx`
- Create: `entrypoints/options/index.html`, `entrypoints/options/main.tsx`, `entrypoints/focus/index.html`, `entrypoints/focus/main.tsx`
- Create: `src/app/background/bootstrapBackground.ts`, `src/app/side-panel/bootstrapSidePanel.tsx`, `src/app/options/bootstrapOptions.tsx`, `src/app/focus/bootstrapFocus.tsx`
- Create: `src/features/{workflow,session,assets,settings}/index.ts`
- Create: `src/platform/{messaging,storage,alarms}/index.ts`, `src/shared/index.ts`
- Test: `tests/architecture/importBoundaries.test.ts`

**Interfaces:**
- Produces path alias `@/* -> src/*` and empty intentional public APIs.
- Produces scripts `build`, `typecheck`, `lint`, `format:check`, `test`, `test:e2e`.

- [ ] Write an architecture test that scans TypeScript imports and rejects feature deep imports, `app` imports from lower modules, Platform-to-feature imports and Domain/Application imports of forbidden packages.
- [ ] Run `pnpm vitest run tests/architecture/importBoundaries.test.ts`; verify it fails because configuration and source roots do not exist.
- [ ] Initialize WXT with the React module, strict TypeScript flags including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, Tailwind 4, Vitest, ESLint and Prettier.
- [ ] Add thin entry points that call only their matching `bootstrap*` function; bootstrap functions may initially render accessible surface names or register an empty background listener.
- [ ] Configure ESLint restricted imports to mirror the architecture test and reject `any`.
- [ ] Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`; verify all pass and inspect the manifest for only `sidePanel`, `storage` and `alarms` permissions.
- [ ] Review `git diff --check` and commit as `chore: establish extension architecture`.

---

### Task 2: Workflow Aggregate

**Files:**
- Create: `src/features/workflow/domain/Workflow.ts`, `Phase.ts`, `Environment.ts`, `RewardDice.ts`, `DiceSide.ts`, `WorkflowErrors.ts`
- Create: `src/features/workflow/domain/createWorkflow.ts`, `rollReward.ts`
- Test: matching `.test.ts` files beside each primary module or function
- Modify: `src/features/workflow/index.ts`

**Interfaces:**
- Produces `Workflow`, `Phase`, `Environment`, `RewardDice`, `DiceSide`, `WorkflowId`, `AssetId`, `DurationSeconds`.
- Produces `createWorkflow(input: CreateWorkflowInput): Workflow` and `rollReward(dice: RewardDice, random: () => number): DiceSide`.

```ts
type Phase = Readonly<{
  type: 'focus' | 'break';
  durationSeconds: DurationSeconds;
  environment: Environment;
}>;

type Workflow = Readonly<{
  id: WorkflowId;
  name: string;
  phases: readonly [Phase, ...Phase[]];
  rewardDice?: RewardDice;
}>;
```

- [ ] Write failing tests for non-empty trimmed names, at least one Phase, positive durations, allowed Phase types and immutable returned values.
- [ ] Write failing tests requiring enabled Reward Dice to have at least two sides, frequency ≥ 1 and strictly positive custom weights.
- [ ] Write deterministic reward tests for equal weights, normalized custom weights and boundary random values in `[0, 1)`.
- [ ] Run `pnpm vitest run src/features/workflow/domain`; verify failures identify missing exports.
- [ ] Implement branded identifiers, constructors and pure validation without framework imports; use lowercase object properties.
- [ ] Run the focused tests, then `pnpm typecheck && pnpm lint && pnpm test`; verify all pass.
- [ ] Review aggregate ownership and public exports; commit as `feat: define workflow aggregate`.

---

### Task 3: Workflow Use Cases and Persistence Adapter

**Files:**
- Create: `src/features/workflow/application/WorkflowRepository.ts`, `createWorkflowUseCase.ts`, `updateWorkflowUseCase.ts`, `deleteWorkflowUseCase.ts`, `duplicateWorkflowUseCase.ts`, `reorderWorkflowsUseCase.ts`, `listWorkflowsUseCase.ts`
- Create: `src/features/workflow/infrastructure/WorkflowRecord.ts`, `mapWorkflowRecord.ts`, `DexieWorkflowRepository.ts`
- Create: `src/platform/storage/FlowariumDatabase.ts`
- Test: focused Application tests with `InMemoryWorkflowRepository.ts`; Dexie integration tests with fake IndexedDB
- Modify: `src/features/workflow/index.ts`, `src/platform/storage/index.ts`

**Interfaces:**

```ts
type WorkflowRepository = {
  list(): Promise<readonly Workflow[]>;
  get(id: WorkflowId): Promise<Workflow | null>;
  save(workflow: Workflow): Promise<void>;
  delete(id: WorkflowId): Promise<void>;
  replaceOrder(ids: readonly WorkflowId[]): Promise<void>;
};
```

- [ ] Write failing use-case tests for create, edit, duplicate with a new ID, delete, list and complete reorder validation.
- [ ] Implement Application use cases against `WorkflowRepository` only.
- [ ] Write failing adapter tests for CRUD, stable ordering, record validation and an ordered version-1 Dexie schema.
- [ ] Implement record schemas, Domain mapping and `DexieWorkflowRepository`; never export storage records from the feature root.
- [ ] Run focused unit and integration tests, then all quality gates.
- [ ] Review that Application has no Dexie import and commit as `feat: persist workflow library`.

---

### Task 4: Durable Session Domain and Application

**Files:**
- Create: `src/features/session/domain/Session.ts`, `SessionSnapshot.ts`, `SessionErrors.ts`, `deriveSessionState.ts`
- Create: `src/features/session/application/SessionRepository.ts`, `Clock.ts`, `SessionEvents.ts`, `startSessionUseCase.ts`, `pauseSessionUseCase.ts`, `resumeSessionUseCase.ts`, `stopSessionUseCase.ts`, `advanceSessionUseCase.ts`, `getActiveSessionUseCase.ts`
- Test: matching Domain and Application tests with `FakeClock.ts` and `InMemorySessionRepository.ts`
- Modify: `src/features/session/index.ts`

**Interfaces:**

```ts
type SessionStatus = 'running' | 'paused' | 'completed' | 'stopped';
type Clock = { now(): number };
type SessionRepository = {
  getActive(): Promise<Session | null>;
  get(id: SessionId): Promise<Session | null>;
  save(session: Session): Promise<void>;
};
```

- [ ] Write failing tests proving the Session contains a deep immutable Workflow snapshot and is unaffected by later source edits.
- [ ] Write transition-table tests for start, pause, resume, stop, phase advance and completion; reject invalid transitions and a second active Session.
- [ ] Write timing tests deriving remaining time from persisted epoch milliseconds, including late wake-up across multiple elapsed Phases.
- [ ] Implement the discriminated Session states and pure transition functions.
- [ ] Implement use cases using only `Clock`, `SessionRepository` and Workflow public types.
- [ ] Run focused tests and full quality gates; review exhaustive state handling and commit as `feat: add durable session lifecycle`.

---

### Task 5: Session Storage, Messaging and MV3 Coordination

**Files:**
- Create: `src/features/session/infrastructure/SessionRecord.ts`, `mapSessionRecord.ts`, `DexieSessionRepository.ts`
- Create: `src/platform/messaging/RuntimeMessage.ts`, `runtimeMessageSchema.ts`, `ChromeMessageBus.ts`
- Create: `src/platform/alarms/AlarmScheduler.ts`, `ChromeAlarmScheduler.ts`
- Create: `src/app/background/createSessionCoordinator.ts`
- Test: repository, message-schema and coordinator integration tests
- Modify: `src/app/background/bootstrapBackground.ts`, `src/platform/*/index.ts`

**Interfaces:**

```ts
type SessionCommand =
  | { type: 'session/start'; commandId: string; workflowId: WorkflowId }
  | { type: 'session/pause'; commandId: string; sessionId: SessionId }
  | { type: 'session/resume'; commandId: string; sessionId: SessionId }
  | { type: 'session/stop'; commandId: string; sessionId: SessionId };

type SessionEvent = { type: 'session/changed'; session: Session | null };
```

- [ ] Write failing runtime-schema tests that reject unknown types, malformed IDs and extra unsafe payloads.
- [ ] Write failing repository tests for one active Session, transactional transition persistence and restoration from records.
- [ ] Write coordinator tests for idempotent `commandId`, alarm reconciliation, restart restoration and `session/changed` broadcasts.
- [ ] Implement validated message transport, Session mapping, Dexie repository and alarm adapter.
- [ ] Compose the coordinator in the background bootstrap; alarms must trigger reconciliation rather than decrement time.
- [ ] Run focused integration tests and full quality gates; inspect that no interval is used as a clock and commit as `feat: coordinate sessions across extension contexts`.

---

### Task 6: Local Asset Lifecycle

**Files:**
- Create: `src/features/assets/domain/Asset.ts`, `AssetErrors.ts`
- Create: `src/features/assets/application/AssetRepository.ts`, `WorkflowAssetReferences.ts`, `importAssetUseCase.ts`, `deleteAssetUseCase.ts`, `listAssetsUseCase.ts`
- Create: `src/features/assets/infrastructure/AssetRecord.ts`, `DexieAssetRepository.ts`, `BrowserAssetUrlService.ts`
- Test: Domain, use-case and IndexedDB integration tests
- Modify: `src/features/assets/index.ts`, `src/platform/storage/FlowariumDatabase.ts`

**Interfaces:**

```ts
type AssetKind = 'image' | 'audio';
type AssetRepository = {
  list(): Promise<readonly Asset[]>;
  getBlob(id: AssetId): Promise<Blob | null>;
  save(asset: Asset, blob: Blob): Promise<void>;
  delete(id: AssetId): Promise<void>;
};
type WorkflowAssetReferences = { count(assetId: AssetId): Promise<number> };
```

- [ ] Write failing tests accepting configured image/audio MIME allowlists and rejecting empty, unsupported or oversized files before writes.
- [ ] Write failing deletion tests that return a referenced-asset error when reference count is nonzero.
- [ ] Write adapter tests for atomic metadata/blob storage, quota-error normalization and object URL creation/revocation.
- [ ] Implement the minimal Domain, use cases and adapters; make byte limits named configuration injected at composition.
- [ ] Run focused tests and full gates; review that Workflow stores only Asset IDs and commit as `feat: manage local assets safely`.

---

### Task 7: Settings and Versioned Import/Export

**Files:**
- Create: `src/features/settings/domain/Settings.ts`
- Create: `src/features/settings/application/SettingsRepository.ts`, `getSettingsUseCase.ts`, `updateSettingsUseCase.ts`
- Create: `src/features/settings/infrastructure/ChromeSettingsRepository.ts`
- Create: `src/features/workflow/application/WorkflowPackage.ts`, `exportWorkflowUseCase.ts`, `importWorkflowUseCase.ts`
- Create: `src/features/settings/application/SettingsPackage.ts`, `exportSettingsUseCase.ts`, `importSettingsUseCase.ts`
- Test: schema, deterministic export and atomic import tests

**Interfaces:**

```ts
type Settings = Readonly<{
  theme: 'system' | 'light' | 'dark';
  reducedMotion: 'system' | 'reduce' | 'no-preference';
  lastSelectedWorkflowId?: WorkflowId;
}>;
type WorkflowPackageV1 = Readonly<{
  kind: 'flowarium/workflow';
  version: 1;
  workflow: unknown;
  assets: readonly unknown[];
}>;
```

- [ ] Write failing settings tests for defaults, validation and `chrome.storage.local` mapping.
- [ ] Write failing export tests for stable key/array ordering, referenced Assets only and transport-safe Asset encoding.
- [ ] Write failing import tests for file and decoded-Asset size limits, unsupported versions, corrupt data, new IDs, rewritten references and zero writes on any validation failure.
- [ ] Implement separate Workflow and settings envelopes plus boundary schemas; do not expose Dexie records.
- [ ] Implement a single Dexie transaction for Workflow package import and independent settings import.
- [ ] Run focused tests and full gates; review collision behavior and commit as `feat: add safe data portability`.

---

### Task 8: Workflow Library and Editor UI

**Files:**
- Create: `src/shared/ui/button/Button.tsx`, `src/shared/ui/button/index.ts`
- Create: `src/shared/ui/dialog/Dialog.tsx`, `src/shared/ui/dialog/index.ts`
- Create: `src/shared/ui/field/Field.tsx`, `src/shared/ui/field/index.ts`
- Create: `src/shared/ui/select/Select.tsx`, `src/shared/ui/select/index.ts`
- Create: `src/features/workflow/presentation/WorkflowLibrary.tsx`, `WorkflowEditor.tsx`, `RewardDiceEditor.tsx`, `useWorkflowEditor.ts`
- Create: `src/features/assets/presentation/AssetLibrary.tsx`, `AssetPicker.tsx`
- Create: `src/features/settings/presentation/SettingsPage.tsx`
- Test: matching React Testing Library tests
- Modify: side-panel and options composition bootstraps

**Interfaces:**
- Consumes Workflow, Asset and Settings use cases from previous tasks.
- Produces accessible side-panel library and options routes without introducing a router unless navigation requires one.

- [ ] Write component tests for library empty state, create, duplicate, delete confirmation, reorder keyboard controls and opening the editor.
- [ ] Write editor tests for ordered focus/break Phases, duration errors, Environment Asset selection and optional Reward Dice validation.
- [ ] Write Asset Library tests for upload rejection, referenced deletion error and accessible audio/image identification.
- [ ] Write Settings Page tests for theme, reduced motion, workflow import/export and settings import/export feedback.
- [ ] Implement semantic, keyboard-operable UI with visible focus and WCAG 2.2 AA tokens; respect `prefers-reduced-motion`.
- [ ] Run component tests, `pnpm typecheck`, lint, full tests and build; manually inspect side-panel narrow width and options responsive layout.
- [ ] Review that components invoke use cases rather than repositories and commit as `feat: build workflow configuration surfaces`.

---

### Task 9: Active Session and Focus UI

**Files:**
- Create: `src/features/session/presentation/ActiveSessionStore.ts`, `ActiveSessionView.tsx`, `SessionControls.tsx`, `RewardResultDialog.tsx`, `connectSessionMessages.ts`
- Create: `src/app/focus/FocusApp.tsx`, `src/app/side-panel/SidePanelApp.tsx`
- Test: Zustand store and component integration tests
- Modify: focus and side-panel bootstraps

**Interfaces:**
- Consumes `SessionCommand`, `SessionEvent` and Workflow presentation contracts.
- Produces a per-context projection store; it is never authoritative or persisted.

- [ ] Write store tests for snapshot hydration, event replacement and disconnect cleanup.
- [ ] Write UI tests for start, pause, resume, stop confirmation, derived countdown display, Phase transition and completion.
- [ ] Write deterministic Reward Dice presentation tests showing a result only after qualifying completed focus Phases.
- [ ] Implement message connection and focused Zustand selectors; compute display time from Session anchors and a presentation clock tick.
- [ ] Implement side-panel controls and full-page Environment with image/audio cleanup and reduced-motion behavior.
- [ ] Run focused tests and full gates; review that Zustand contains no repositories or business transitions and commit as `feat: build active session experience`.

---

### Task 10: Extension End-to-End Validation and Release Gates

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/extensionFixture.ts`
- Create: `tests/e2e/workflowExecution.spec.ts`, `sessionRestoration.spec.ts`, `dataPortability.spec.ts`, `assetLifecycle.spec.ts`, `accessibility.spec.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`, `README.md`

**Interfaces:**
- Consumes the built unpacked extension from `.output/chrome-mv3`.
- Produces repeatable CI gates and documented local commands.

- [ ] Create a persistent-context fixture that loads the built extension and exposes side-panel/options/focus extension URLs without relying on a personal Chrome profile.
- [ ] Add an E2E journey that creates a Workflow with local Assets and Reward Dice, starts it, pauses/resumes, completes it and verifies history.
- [ ] Add restart restoration coverage by closing surfaces, allowing background suspension/reload, reopening and asserting timestamp-derived state.
- [ ] Add import/export round-trip and corrupt-package rejection coverage, including proof that failed import leaves existing records unchanged.
- [ ] Add referenced-Asset deletion and offline/no-network-request coverage; fail the test on any unexpected request.
- [ ] Add keyboard-only critical-flow coverage and automated accessibility checks for all four surfaces.
- [ ] Configure CI to run install with frozen lockfile, formatting, type checking, linting, unit/component/integration tests, build and E2E tests.
- [ ] Run `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`; record all passing output in the milestone review.
- [ ] Inspect the generated manifest for no host permissions, review bundle composition and verify the 500 ms local-data-to-interactive target on the reference development machine.
- [ ] Update README with supported scope, development commands and loading the unpacked extension; review the entire diff and commit as `test: verify flowarium mvp journeys`.

---

## Milestone Review Order

1. Tasks 1–3: repository setup, boundaries and persistent Workflow Library.
2. Tasks 4–5: authoritative durable Session execution.
3. Tasks 6–7: Assets, settings and safe data portability.
4. Tasks 8–9: complete accessible user experience.
5. Task 10: extension-runtime verification and release readiness.

At each milestone, run all available gates, inspect `git diff --check`, compare the
implementation against the concept documents and accepted ADRs, and correct drift
before starting the next milestone.
