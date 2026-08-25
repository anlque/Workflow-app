# Testing and Debugging

This is the command and incident reference for the current repository. The
normative testing principles remain in
[Testing Strategy](../concepts/08_TESTING_STRATEGY.md).

## Test Map

Vitest uses two explicit projects from
[`vitest.config.ts`](../../vitest.config.ts):

| Pattern               | Project/environment                   | Use                                                                                                                  |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `**/*.test.ts`        | `unit` / Node                         | Domain and Application behavior, adapters with fakes, serialization, messaging, architecture and non-React app logic |
| `**/*.test.tsx`       | `ui` / jsdom                          | React components and hooks through Testing Library                                                                   |
| `tests/e2e/*.spec.ts` | Playwright / built Chromium extension | Assembled extension-origin journeys, real background worker, IndexedDB, Chrome Storage and runtime messaging         |

The names describe the runner environment, not a strict test-level taxonomy. A
`.test.ts` repository test is an integration test even though Vitest calls its
project `unit`.

### Node Tests

Node tests stay next to their owners. Repository tests that need IndexedDB
import `fake-indexeddb/auto` explicitly; fake IndexedDB is not enabled for every
test. This proves repository mapping, transactions and compatibility without a
browser profile. It does not prove Chromium's storage quota or lifecycle.

[`tests/architecture/importBoundaries.test.ts`](../../tests/architecture/importBoundaries.test.ts)
scans every TypeScript import and rejects feature deep imports, lower-layer app
imports, Platform → Feature dependencies and unstable dependencies from Domain
or Application. ESLint enforces corresponding rules during editing; the test is
an independent repository-wide proof.

### jsdom Tests

[`src/test/setup.ts`](../../src/test/setup.ts) installs jest-dom matchers,
cleans React Testing Library after each test and replaces media `play()`/`pause()`
with deterministic stubs. It does not implement real audio decoding, autoplay
policy, `<dialog>` layout or browser side-panel behavior. Tests should use roles,
labels and visible behavior; use `data-testid` only when no semantic query fits.

### End-to-End Tests

Playwright scenarios live under [`tests/e2e/`](../../tests/e2e/) and are grouped
by user journey: workflow execution, restoration, portability, Asset lifecycle
and accessibility/performance/manifest checks. They are intentionally fewer and
slower than the colocated suite.

## Verification Commands

Run commands from the repository root.

| Command             | What it proves                                                                                    | What it does not prove                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm format:check` | Files included by Prettier match repository formatting                                            | `docs/`, generated output and `pnpm-lock.yaml` are excluded by `.prettierignore` |
| `pnpm typecheck`    | Strict TypeScript resolves and checks without emitting                                            | Runtime input validity or browser behavior                                       |
| `pnpm lint`         | ESLint strict/stylistic rules and import restrictions pass with zero warnings                     | Runtime tests or generated manifest correctness                                  |
| `pnpm test`         | Both Vitest projects pass, including Domain, components, repositories, messaging and architecture | A built extension or actual Chromium shell                                       |
| `pnpm build`        | WXT creates `.output/chrome-mv3` and its production manifest/bundles                              | User journeys; Chrome must still load or Playwright must exercise the artifact   |
| `pnpm test:e2e`     | Rebuilds, then runs all Playwright extension journeys                                             | Chrome's toolbar UI and native side-panel container interactions                 |

For fast local feedback, target the narrowest owner:

```bash
pnpm vitest run src/features/session/domain/Session.test.ts
pnpm vitest run src/features/workflow
pnpm exec playwright test tests/e2e/dataPortability.spec.ts
```

A focused pass is not the completion gate. Before handing off a changing phase,
run the checks proportional to its scope and finish with the full required gate.

### CI Order

The single `verify` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
uses Node 22 and pnpm 10.14 with a frozen lockfile:

1. install dependencies;
2. install Chromium and its Linux system dependencies;
3. `pnpm format:check`;
4. `pnpm typecheck`;
5. `pnpm lint`;
6. `pnpm test`;
7. `pnpm build`;
8. `pnpm exec playwright test`.

CI calls build and Playwright separately; locally `pnpm test:e2e` combines them.
Playwright uses one worker, no local retry and two CI retries. A retained trace is
available after failure.

## How the Playwright Extension Fixture Works

[`extensionFixture.ts`](../../tests/e2e/extensionFixture.ts) performs this setup
for each test:

1. It resolves `.output/chrome-mv3`, so a production build must exist. The
   package `test:e2e` script guarantees this; direct `playwright test` does not.
2. It launches Playwright's pinned Chromium headlessly with a persistent context
   and a temporary isolated user-data directory.
3. Chromium loads only that unpacked extension through
   `--disable-extensions-except` and `--load-extension`.
4. The fixture waits for the real MV3 service worker and derives the generated
   extension ID from its `chrome-extension://` URL.
5. It exposes direct generated URLs for `/options.html`, `/sidepanel.html` and
   `/focus.html`.
6. The context closes after the test, so profile state is not shared with other
   tests or the developer's Chrome profile.

`expireActiveSessionDeadline()` is test support: it changes the active Session
deadline directly in that isolated IndexedDB and schedules the real named alarm.
It exists to avoid real multi-minute waits and is not a production API pattern.

### Fixture Coverage Boundary

The fixture verifies built extension documents, service-worker messaging,
alarms, persistence and generated manifest behavior. Because pages are opened by
direct extension URL, it does not reproduce:

- Chrome's native toolbar/action UI;
- the native side-panel container or its sizing/lifecycle;
- the user's `chrome://extensions` reload flow;
- every browser-shell `sidePanel.open()`/`sidePanel.close()` constraint;
- audio autoplay behavior with real speakers;
- development-server/HMR behavior in `.output/chrome-mv3-dev`.

Keep focused adapter tests for browser calls and manually verify browser-shell
changes in supported Chrome when those interactions materially change.

## Debugging Playbooks

Start with the first observable boundary. Do not delete browser data as a
default response: persisted rejection is evidence needed to identify a mapper,
compatibility or schema problem.

### Background Worker Does Not Start

- **First check:** on `chrome://extensions`, open Flowarium's service-worker
  inspector and look for `Flowarium background initialization failed.` or a WXT
  startup crash. Confirm a worker URL exists for the extension ID you loaded.
- **Owner:** [`entrypoints/background.ts`](../../entrypoints/background.ts),
  [`bootstrapBackground.ts`](../../src/app/background/bootstrapBackground.ts),
  then the repository/message/alarm adapter named in the error.
- **Common causes:** stale unpacked build, invalid composed IndexedDB schema,
  storage mapping rejection or missing generated bundle.
- **Proof command:**

  ```bash
  pnpm vitest run src/app/background src/platform src/features/session/infrastructure
  pnpm build
  ```

Reload the unpacked extension only after a successful build; then inspect the
new worker rather than an already-open extension page.

### Chrome Is Running a Stale Unpacked Build

- **First check:** compare the loaded path on `chrome://extensions` with the
  intended artifact: `.output/chrome-mv3-dev` requires a live `pnpm dev` process;
  `.output/chrome-mv3` is the last production build.
- **Owner:** WXT output from [`wxt.config.ts`](../../wxt.config.ts) and the
  [`entrypoints/`](../../entrypoints/) composition files.
- **Recovery:** rebuild if production, use **Reload** on `chrome://extensions`,
  then reopen the surface. Never edit `.output` to patch the symptom.
- **Proof command:**

  ```bash
  pnpm build
  pnpm exec playwright test tests/e2e/accessibility.spec.ts
  ```

The manifest E2E assertion also catches unexpected production permissions.

### UI Surface Does Not Refresh

- **First check:** identify the stale authority. Workflow lists should receive a
  `workflow/catalog-changed` invalidation and reload IndexedDB; Session views
  should receive `session/changed` or hydrate through `session/get-active`.
  Inspect the surface console for its visible `refreshError`/connection error.
- **Owner:** [`runWorkflowCatalogMutation.ts`](../../src/app/runWorkflowCatalogMutation.ts),
  [`useWorkflowCatalog.ts`](../../src/features/workflow/presentation/useWorkflowCatalog.ts)
  for catalogs; `ChromeSessionClient` and
  [`connectSessionMessages.ts`](../../src/features/session/presentation/connectSessionMessages.ts)
  for Sessions.
- **Important distinction:** catalog events invalidate reusable Workflows but do
  not mutate an active Session's immutable snapshot.
- **Proof command:**

  ```bash
  pnpm vitest run src/app/runWorkflowCatalogMutation.test.ts src/features/workflow/presentation/useWorkflowCatalog.test.tsx src/features/session/presentation/ActiveSessionStore.test.ts
  ```

### Runtime Message Is Rejected or Ignored

- **First check:** inspect the actual envelope at sender and receiver. Commands
  and requests require exact keys and non-empty IDs; an unrelated message is
  intentionally ignored rather than answered by every listener.
- **Owner:** [`runtimeMessageSchema.ts`](../../src/platform/messaging/runtimeMessageSchema.ts),
  [`ChromeMessageBus.ts`](../../src/platform/messaging/ChromeMessageBus.ts) and
  [`ChromeSessionClient.ts`](../../src/app/session/ChromeSessionClient.ts).
- **Response symptom:** `Background returned an invalid response.` means transport
  returned a shape outside `{ ok: true, result } | { ok: false, error }`; a
  Domain/Application error appears as the response's error string.
- **Proof command:**

  ```bash
  pnpm vitest run src/platform/messaging src/app/session
  ```

### IndexedDB Record Is Rejected

- **First check:** capture the error and inspect the `flowarium` record in the
  extension page's DevTools **Application → IndexedDB**. Check outer
  `schemaVersion`, required fields and state-specific values; for Assets also
  compare Blob MIME/size with metadata.
- **Owner:** the feature mapper/repository under
  `src/features/{workflow,session,assets}/infrastructure/`, plus
  [`FlowariumDatabase.ts`](../../src/platform/storage/FlowariumDatabase.ts) for
  composed schema versions.
- **Recovery:** reproduce with the captured shape in a repository regression
  test and decide whether it is corruption or supported legacy data. Add a
  forward-compatible mapper/migration when required. Do not cast it to a Domain
  type or clear the database to make the test pass.
- **Proof command:**

  ```bash
  pnpm vitest run src/features/workflow/infrastructure src/features/session/infrastructure src/features/assets/infrastructure
  ```

### Audio Is Silent or Locked by Autoplay

- **First check:** in focus, look for **Enable sounds**. Click it and confirm the
  volume is non-zero. Ambient audio may separately show **Enable audio** if
  `HTMLMediaElement.play()` was blocked.
- **Owner:** [`createUiSoundPlayer.ts`](../../src/app/focus/createUiSoundPlayer.ts)
  for bell/Dice/celebration Web Audio and
  [`useAmbientAudio.ts`](../../src/app/focus/useAmbientAudio.ts) for the hidden
  looping media element/fades.
- **Boundary:** sounds are Presentation feedback. Failure is swallowed or shown
  as an enable action and must never stop authoritative Session progress.
- **Proof command:**

  ```bash
  pnpm vitest run src/app/focus
  ```

jsdom proves state/sequence with stubs, not audibility. Confirm real autoplay and
speaker output manually in the focus tab.

### Side-Panel Button State or Open/Close Behavior Is Wrong

- **First check:** confirm Chrome 141+ and use the native side-panel control once
  while watching whether the focus button label changes. The focus projection is
  driven by `sidePanel.onOpened`/`onClosed`; the current adapter does not query an
  initial open state.
- **Owner:** [`closeSidePanel.ts`](../../src/app/closeSidePanel.ts) and focus
  `togglePanel()` in [`FocusApp.tsx`](../../src/app/focus/FocusApp.tsx). Focus-tab
  creation is separately owned by `createFocusTabController`.
- **Failure behavior:** the button updates optimistically and rolls back when the
  browser call rejects. Inspect the focus console for browser API rejection and
  verify the current window has an ID.
- **Proof command:**

  ```bash
  pnpm vitest run src/app/focus/FocusApp.test.tsx src/app/focus/createChromeFocusTabController.test.ts src/app/background/createFocusTabController.test.ts
  ```

The Playwright fixture does not prove the native container; finish with manual
Chrome verification for this behavior.

### Playwright Cannot Find or Start Chromium

- **First check:** read the launch error. Missing executable errors indicate the
  pinned browser is not installed; extension load errors usually indicate a
  missing/stale `.output/chrome-mv3` build instead.
- **Owner:** local Playwright browser installation,
  [`playwright.config.ts`](../../playwright.config.ts) and
  [`extensionFixture.ts`](../../tests/e2e/extensionFixture.ts).
- **Recovery:** install the pinned browser once. On Linux CI or a fresh Linux
  machine, include its system dependencies.
- **Proof command:**

  ```bash
  pnpm exec playwright install chromium
  pnpm test:e2e
  ```

CI uses `pnpm exec playwright install --with-deps chromium` before the build and
test sequence.

## Selecting the Next Test

Use the lowest layer that proves the changed contract:

| Change                                  | First proof                                         | Add broader proof when                                          |
| --------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Domain invariant, timing or probability | colocated `.test.ts` with injected clock/randomness | serialization or assembled behavior also changes                |
| Application use case/port               | use case with an in-memory fake                     | concrete transaction/message behavior matters                   |
| Record mapper/repository/schema         | fake-IndexedDB repository test                      | a production migration or cross-context restoration changes     |
| React form/dialog/hook                  | `.test.tsx` with semantic queries                   | the full extension journey or browser shell changes             |
| Import direction/public API             | architecture test and lint                          | a deliberate boundary change also requires Concept/ADR updates  |
| Cross-context user journey              | focused lower-layer tests first, then Playwright    | always for a critical assembled regression not otherwise proven |

For a production bug, reproduce it with the narrowest failing regression test
before implementing the fix, then run the owning feature and full gate.
