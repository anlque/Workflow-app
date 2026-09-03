# Project Map

This page maps the current repository by ownership. Use it to decide where to
look before editing; use the linked Concepts and ADRs for the rules that govern
those locations.

## Source Layout

| Location | Owner | Contains | May depend on | Why it exists |
| --- | --- | --- | --- | --- |
| [`src/app/`](../../src/app/) | Application composition | Runtime bootstraps, dependency factories, surface components and surface-specific browser adapters | Feature root APIs, `platform`, `shared`, React and WXT/browser APIs | Connects concrete adapters to use cases and renders each extension surface; it must not own business rules |
| [`src/features/`](../../src/features/) | Business capabilities | Workflow, Session, Assets and Settings modules | A feature's inward layers, another feature's root API when necessary, and `shared` | Keeps business behavior organized by capability rather than framework or file type |
| [`src/platform/`](../../src/platform/) | Browser-independent platform boundaries and Chrome adapters | Alarms, runtime messaging and the composed IndexedDB database | `shared`, browser/storage libraries and WXT/browser APIs; never features or `app` | Isolates execution-environment mechanisms that are not owned by one feature |
| [`src/shared/`](../../src/shared/) | Minimal Shared Kernel and reusable UI | `AssetId` plus Button, Dialog, Field and Select primitives | Frameworks required by the shared primitive; never feature or `app` internals | Holds only code already shared across independent owners |
| [`src/styles/`](../../src/styles/) | Cross-surface visual system | Global reset, tokens, semantic classes and responsive rules in `global.css` | CSS only | Gives the three React documents one current visual language |
| [`src/test/`](../../src/test/) | Vitest environment | jsdom matchers, fake IndexedDB and browser test doubles | Test libraries | Establishes shared test runtime behavior, not production behavior |

`src/assets/` does not currently exist. If it is introduced, it is reserved for
static resources bundled with the extension. It must not be confused with
[`src/features/assets/`](../../src/features/assets/), which owns the user's
reusable image and audio Asset records and behavior.

## Composition and Surface Owners

| Location | Owner | Contains | May depend on | Why it exists |
| --- | --- | --- | --- | --- |
| [`src/app/background/`](../../src/app/background/) | Background worker | `bootstrapBackground`, focus-action registration and the authoritative Session coordinator | Feature root APIs, platform adapters and WXT/browser APIs | Composes the non-React MV3 worker that owns active Session execution |
| [`src/app/focus/`](../../src/app/focus/) | Focus view | `FocusApp`, launcher/environment views, audio behavior, focus-tab controller, bootstrap and dependency factory | Feature root APIs, platform APIs, shared UI and browser APIs | Composes the full-page focus experience and its local presentation effects |
| [`src/app/options/`](../../src/app/options/) | Options page | `OptionsApp`, bootstrap and CRUD/import/export dependency factory | Feature root APIs, platform APIs and browser/document APIs | Composes Workflow editing, Asset management and Settings |
| [`src/app/side-panel/`](../../src/app/side-panel/) | Side panel | `SidePanelApp`, compact Session bar, bootstrap and dependency factory | Feature root APIs, platform APIs, shared UI and browser APIs | Composes compact Workflow and Session access in Chrome's side panel |
| [`src/app/session/`](../../src/app/session/) | Cross-surface Session client | `ChromeSessionClient` | Session and messaging public APIs plus an injected runtime transport | Gives React surfaces a validated client for background Session commands and projections |
| [`src/app/closeSidePanel.ts`](../../src/app/closeSidePanel.ts) | Focus surface browser integration | Side-panel open, close and state subscription helpers | WXT/browser APIs | Keeps a surface-specific Chrome integration near its composition owner |
| [`src/app/runWorkflowCatalogMutation.ts`](../../src/app/runWorkflowCatalogMutation.ts) | Catalog mutation composition | Success-only Workflow catalog invalidation wrapper | Workflow catalog event port | Ensures Options and side-panel mutations publish the same invalidation behavior |

Files in `src/app/` are composition code. Lower modules must not import them.

## Feature Shape

Each current feature exposes a root [`index.ts`](../../src/features/) and uses
only the layers it needs:

| Layer | Owns | May depend on | Must not own |
| --- | --- | --- | --- |
| `domain/` | Entities, value objects, invariants and Domain errors | Its feature's Domain modules and the minimal Shared Kernel | React, browser APIs, persistence or use-case orchestration |
| `application/` | Use cases, ports, package contracts and Application errors | Its feature's Domain layer and another feature's root API only when the contract requires it | Concrete adapters, React or browser APIs |
| `infrastructure/` | Repository implementations, records, mappers and feature-specific external adapters | Domain/Application contracts, platform mechanisms and implementation libraries | Business policy that belongs in Domain or Application |
| `presentation/` | React components, hooks, projections and UI state | The feature's Application/Domain API, React/Zustand and shared UI | Authoritative cross-context state or persistence details |
| `index.ts` | The feature's supported public API | Selected internal exports | Private implementation details that consumers do not need |

Consumers outside a feature import from its root, for example
`@/features/workflow`, not `@/features/workflow/domain/Workflow`.

## Workflow Feature

[`src/features/workflow/`](../../src/features/workflow/) owns the Workflow
aggregate and everything configured as part of it.

| Location | Owner | Contains | May depend on | Why it exists |
| --- | --- | --- | --- | --- |
| [`domain/`](../../src/features/workflow/domain/) | Workflow Domain | `Workflow`, `Phase`, `Environment`, Reward Dice, Dice Side, creation, reward eligibility/selection and validation errors | Domain modules and Shared Kernel `AssetId` | Protects Workflow invariants independently of UI and storage |
| [`application/`](../../src/features/workflow/application/) | Workflow use cases | Repository port; create, update, delete, duplicate, list and reorder use cases; Workflow package import/export contracts | Workflow Domain and Assets root API where package operations require Asset contracts | Coordinates changes to Workflows without choosing persistence or UI |
| [`infrastructure/`](../../src/features/workflow/infrastructure/) | Workflow persistence | IndexedDB records/mapping, Dexie repository and atomic Workflow-package unit of work | Workflow Application/Domain contracts, Assets public contracts and storage platform | Adapts Workflow and package operations to IndexedDB |
| [`presentation/`](../../src/features/workflow/presentation/) | Workflow UI | Library, editor, Reward Dice editor and catalog/editor hooks | Workflow public behavior, React and shared UI | Provides reusable Workflow screens and local draft/catalog state |
| [`index.ts`](../../src/features/workflow/index.ts) | Workflow public API | Supported Domain types/functions, use cases/ports/packages, Dexie adapters/schema fragments and presentation exports | Workflow internals | Defines the only supported external import boundary |

`WorkflowLibrary` is the presentation of a collection of Workflows, not another
persisted Entity or a separate feature.

## Session Feature

[`src/features/session/`](../../src/features/session/) owns Session lifecycle,
timing rules and presentation projections. The background composition remains
the authority that executes those rules.

| Location | Owner | Contains | May depend on | Why it exists |
| --- | --- | --- | --- | --- |
| [`domain/`](../../src/features/session/domain/) | Session Domain | Session state variants, immutable Workflow snapshot, restoration, timing derivation and errors | Session Domain modules and Workflow root types | Models valid Session states without knowing Chrome, React or Dexie |
| [`application/`](../../src/features/session/application/) | Session use cases | Clock/repository ports; start, advance, pause, resume, reward continuation, stop and active lookup | Session Domain and Workflow root types | Coordinates lifecycle changes through explicit ports |
| [`infrastructure/`](../../src/features/session/infrastructure/) | Session persistence | Session record, mapper, schema fragment and Dexie repository | Session Application/Domain and storage platform | Persists and restores Session state without leaking records inward |
| [`presentation/`](../../src/features/session/presentation/) | Session UI projection | Zustand store, message connection, projection parser, countdown helpers, controls, active view and Reward dialog/cube | Session public behavior, Workflow root types, React/Zustand and shared UI | Mirrors authoritative background state and renders local interactions |
| [`index.ts`](../../src/features/session/index.ts) | Session public API | Supported Domain/Application contracts, Dexie adapter/schema and projection exports | Session internals | Keeps composition code out of internal feature paths |

## Assets Feature

[`src/features/assets/`](../../src/features/assets/) owns imported image and
audio Assets. It is a business feature, not a static-file directory.

| Location | Owner | Contains | May depend on | Why it exists |
| --- | --- | --- | --- | --- |
| [`domain/`](../../src/features/assets/domain/) | Asset Domain | Asset identity, kind, metadata construction and errors | Shared Kernel `AssetId` | Defines valid user-managed Assets independently of files and IndexedDB |
| [`application/`](../../src/features/assets/application/) | Asset use cases | Repository/reference ports and import, list and reference-aware delete use cases | Asset Domain | Coordinates Asset policy and lifecycle through ports |
| [`infrastructure/`](../../src/features/assets/infrastructure/) | Asset storage/browser adaptation | Asset record/schema, Dexie repository and browser object-URL service | Asset Application/Domain, storage platform and browser Blob/URL APIs | Stores Asset metadata/blobs and adapts blobs for presentation |
| [`presentation/`](../../src/features/assets/presentation/) | Asset UI | Asset library, picker and preview | Asset public behavior, React and shared UI | Reuses Asset selection and preview behavior across owning surfaces |
| [`index.ts`](../../src/features/assets/index.ts) | Assets public API | Supported contracts, use cases, Domain values, adapters/schema and UI | Assets internals | Provides the cross-feature Asset boundary used by Workflow packaging |

## Settings Feature

[`src/features/settings/`](../../src/features/settings/) owns application-wide
preferences stored outside IndexedDB.

| Location | Owner | Contains | May depend on | Why it exists |
| --- | --- | --- | --- | --- |
| [`domain/`](../../src/features/settings/domain/) | Settings Domain | Theme, reduced-motion preference, last-selected Workflow, defaults and validation | Domain-only modules | Defines valid preferences without storage or UI concerns |
| [`application/`](../../src/features/settings/application/) | Settings use cases | Repository port, get/update and package import/export | Settings Domain | Coordinates Settings and validates their external package envelope |
| [`infrastructure/`](../../src/features/settings/infrastructure/) | Settings persistence | `ChromeSettingsRepository` and injected storage-area contract | Settings Application/Domain and Chrome storage through an adapter | Stores the single Settings value under `chrome.storage.local` |
| [`presentation/`](../../src/features/settings/presentation/) | Settings UI | `SettingsPage` | Settings public behavior, React and shared UI | Edits preferences without exposing storage details |
| [`index.ts`](../../src/features/settings/index.ts) | Settings public API | Supported Domain, use-case, package, repository, adapter and presentation exports | Settings internals | Defines the supported dependency surface |

## Platform and Shared Modules

| Location | Owner | Contains | May depend on | Why it exists |
| --- | --- | --- | --- | --- |
| [`src/platform/alarms/`](../../src/platform/alarms/) | Alarm boundary | `AlarmScheduler` port and `ChromeAlarmScheduler` | WXT/browser APIs | Gives background Session coordination a replaceable deadline wake-up mechanism |
| [`src/platform/messaging/`](../../src/platform/messaging/) | Runtime communication | Message types, exact parsers, bus contract/Chrome adapter and Workflow catalog events | WXT/browser APIs | Defines typed communication between isolated extension contexts |
| [`src/platform/storage/`](../../src/platform/storage/) | Database composition | `LocusoraDatabase`, schema-fragment types and Dexie configuration | Dexie | Composes feature-owned schemas into the single local database |
| [`src/shared/domain/`](../../src/shared/domain/) | Minimal Shared Kernel | `AssetId` | No feature or platform module | Gives Workflow and Assets one identity contract without duplicating it |
| [`src/shared/ui/`](../../src/shared/ui/) | UI primitives | Button, Dialog, Field and Select components with local barrels/tests | React | Centralizes genuinely reused accessible primitives, not feature behavior |

## Files Outside `src`

| Location | Owner | Contains | Why it exists |
| --- | --- | --- | --- |
| [`entrypoints/`](../../entrypoints/) | WXT discovery boundary | Background entry and HTML/`main.tsx` pairs for focus, Options and side panel | Gives WXT physical extension documents that immediately delegate to `src/app/` |
| [`package.json`](../../package.json) and [`pnpm-lock.yaml`](../../pnpm-lock.yaml) | Package contract | Scripts, dependency versions and pinned package manager | Makes installs and verification reproducible |
| [`wxt.config.ts`](../../wxt.config.ts) | Extension configuration | Manifest metadata, permissions, side-panel setup and browser minimum | Produces development and production Chrome MV3 manifests |
| [`tsconfig.json`](../../tsconfig.json) | TypeScript configuration | Strict compiler options and aliases through WXT | Defines the compile-time contract |
| [`eslint.config.js`](../../eslint.config.js) | Static rules | Strict typed ESLint and import-boundary restrictions | Rejects invalid dependencies during development and CI |
| [`vitest.config.ts`](../../vitest.config.ts) and [`src/test/setup.ts`](../../src/test/setup.ts) | Unit/component test configuration | Node/jsdom projects and shared setup | Runs fast tests in the correct environment |
| [`playwright.config.ts`](../../playwright.config.ts) and [`tests/e2e/`](../../tests/e2e/) | Extension journey tests | Chromium fixture and assembled MVP journeys | Proves production extension pages and worker behavior together |
| [`tests/architecture/`](../../tests/architecture/) | Architecture verification | Source import scan | Provides a second executable check of dependency direction |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Continuous integration | Repository verification pipeline | Applies the project checks outside a developer machine |
| [`docs/concepts/`](../concepts/) | Normative documentation | Product, Domain, architecture and engineering rules | Defines what implementation must satisfy |
| [`docs/adr/`](../adr/) | Decision history | Accepted architecture decisions and index | Records why stable choices were made |

Generated `.wxt/`, `.output/`, `coverage/`, `test-results/` and
`node_modules/` directories are not source owners. Do not edit or document their
contents as application architecture.

## Naming and Discovery

Filename casing follows the primary exported symbol:

- React components, Domain types and classes use PascalCase files, such as
  [`WorkflowEditor.tsx`](../../src/features/workflow/presentation/WorkflowEditor.tsx),
  [`Workflow.ts`](../../src/features/workflow/domain/Workflow.ts) and
  [`ChromeSessionClient.ts`](../../src/app/session/ChromeSessionClient.ts).
- Function, hook and utility modules use camelCase files, such as
  [`createWorkflow.ts`](../../src/features/workflow/domain/createWorkflow.ts)
  and
  [`useWorkflowCatalog.ts`](../../src/features/workflow/presentation/useWorkflowCatalog.ts).
- Tests match the source name with `.test.ts` or `.test.tsx`; assembled journeys
  use `.spec.ts`.
- A feature's root `index.ts` is the first place to discover supported exports.

This convention implements the
[One Concept — One Name rule](../concepts/07_CODING_STANDARDS.md#one-concept--one-name)
and makes symbol search and file search converge.

## Normative Owners

- [Architecture](../concepts/03_ARCHITECTURE.md) defines dependency direction.
- [Folder Structure](../concepts/04_FOLDER_STRUCTURE.md) defines directory and
  public-API rules.
- [Coding Standards](../concepts/07_CODING_STANDARDS.md) defines naming.
- [ADR-0008](../adr/ADR-0008-browser-integration-boundaries.md) defines browser
  adapter placement.
- [ADR-0009](../adr/ADR-0009-minimal-shared-kernel.md) defines the Shared Kernel.
- [ADR-0010](../adr/ADR-0010-indexeddb-schema-composition.md) defines database
  schema composition.
