# Architecture Boundaries

Start here when deciding whether an import or responsibility belongs in a
module. Normative direction is owned by
[Architecture](../concepts/03_ARCHITECTURE.md),
[Folder Structure](../concepts/04_FOLDER_STRUCTURE.md) and
[ADR-0002](../adr/ADR-0002-feature-first-clean-architecture.md). This page maps
those rules to current enforcement and source owners.

## Allowed Dependency Direction

```text
entrypoints
    |
    v
app composition ---------------------> platform adapters
    |                                      |
    v                                      | implements technical boundaries
feature root API                           |
    |                                      |
    +--> presentation                      |
    |         |                            |
    |         v                            |
    +--> application <----- infrastructure+
    |         |
    |         v
    +------> domain

domain/application ---> minimal shared contracts when genuinely cross-feature
presentation/app -----> shared UI
```

Runtime calls can point outward through an injected port even though source
imports point inward. For example, `startSessionUseCase` calls a
`SessionRepository`; `DexieSessionRepository` imports and implements that port.
The use case never imports Dexie.

## Boundary Matrix

| Source owner | May import | Must not import |
| --- | --- | --- |
| Feature `domain/` | Its own Domain modules; approved Shared Kernel contracts | Application, Infrastructure, Presentation, React, Zustand, Dexie, WXT/browser or `app` |
| Feature `application/` | Its own Domain; another feature's root API only for an explicit contract; approved Shared Kernel contracts | Concrete Infrastructure, Presentation, React, Zustand, Dexie, WXT/browser, platform implementations or `app` |
| Feature `infrastructure/` | Its own Domain/Application contracts, implementation libraries, platform mechanisms and another feature's root API when an explicit adapter spans them | `app`, another feature's internal path, Presentation-owned policy |
| Feature `presentation/` | Its own inward behavior, another feature's root public API, React/Zustand and shared UI | Concrete Infrastructure, `app` or direct browser APIs |
| `platform/` | Generic libraries and WXT/browser APIs | Features, `app` or business rules |
| `shared/` | Frameworks needed by a shared primitive and deliberately approved Shared Kernel modules | `app`, feature internals or feature-owned business behavior |
| `app/` | Feature root APIs, platform, shared, React and narrow WXT/browser APIs | Business invariants or persistence record logic |
| `entrypoints/` | Matching `src/app/` bootstrap and global styles | Feature orchestration or business logic |

`May import` is not a reason to add a dependency. It defines the outer limit;
the dependency must still be needed by the owner's responsibility.

## Feature Public APIs

Every feature exposes an intentional root `index.ts`. External consumers use:

```ts
import { startSessionUseCase } from '@/features/session';
import { type Workflow } from '@/features/workflow';
```

They do not use:

```ts
import { startSessionUseCase } from '@/features/session/application/startSessionUseCase';
import { type Workflow } from '@/features/workflow/domain/Workflow';
```

Relative imports inside the owning feature are allowed. The rule applies when a
module crosses a feature boundary. Root exports are deliberately broad enough
for composition—including selected Infrastructure adapters—but they remain an
explicit review point: adding an export creates a supported coupling surface.

Current feature roots:

- [`assets/index.ts`](../../src/features/assets/index.ts);
- [`session/index.ts`](../../src/features/session/index.ts);
- [`settings/index.ts`](../../src/features/settings/index.ts);
- [`workflow/index.ts`](../../src/features/workflow/index.ts).

## Browser Adapter Placement

[ADR-0008](../adr/ADR-0008-browser-integration-boundaries.md) assigns browser
integrations by meaning:

| Meaning | Current owner | Examples |
| --- | --- | --- |
| Reusable business-independent capability | `src/platform/` | `ChromeAlarmScheduler`, `ChromeMessageBus`, Workflow catalog runtime events |
| Feature-specific Application-port implementation | Feature `infrastructure/` | `ChromeSettingsRepository` |
| Surface lifecycle, navigation or composition | `src/app/` | focus-tab open/activate, Options opening, side-panel open/close, runtime transport injection |
| WXT discovery only | `entrypoints/` | `defineBackground`, document bootstrap calls and global CSS import |

Domain and Application never import browser APIs. Feature Presentation also
receives browser-dependent actions as functions or stable interfaces. A browser
wrapper should create a real boundary—typing, validation, lifecycle,
normalization or testability—not merely rename an API.

## Minimal Shared Kernel

[`src/shared/domain/AssetId.ts`](../../src/shared/domain/AssetId.ts) is the only
current cross-feature Domain contract. Workflow Environments reference Assets,
so both features require exactly the same branded identity semantics.

Under [ADR-0009](../adr/ADR-0009-minimal-shared-kernel.md), another contract may
enter `shared/domain` only if it:

- represents one identical concept used by independent features;
- contains no lifecycle, business rule, persistence shape or framework;
- has no clearer owning feature;
- is reviewed as explicit cross-feature coupling.

Reusable business behavior does not automatically qualify. `Workflow`,
`Session`, Reward Dice and Asset construction remain with their features.

`src/shared/ui` follows a separate rule: it owns stable presentation primitives
already reused by multiple consumers, not feature screens or speculative
components.

## Composition Root Responsibilities

`src/app` is allowed to know concrete implementations. A composition root may:

- combine all feature schema fragments in the same version order;
- instantiate repositories and browser adapters;
- adapt browser callbacks to typed ports;
- inject clocks, identity generators and surface lifecycle functions;
- expose use cases as dependency-object functions;
- connect runtime projections to the current React surface;
- register cleanup for object URLs, audio or message subscriptions.

It must not decide whether a Session transition is valid, normalize Reward Dice
weights, define record compatibility or implement another feature's invariant.
Those decisions remain with Domain, Application or Infrastructure owners.

## Persistence Composition Boundary

Feature Infrastructure owns its record, mapper, repository and database schema
fragment. [`LocusoraDatabase`](../../src/platform/storage/LocusoraDatabase.ts)
knows how to apply cumulative fragments but knows nothing about Workflow,
Session or Asset behavior. Each runtime composition root supplies the same
fragments:

```ts
[
  ...workflowDatabaseSchemas,
  ...sessionDatabaseSchemas,
  ...assetDatabaseSchemas,
]
```

This avoids a Platform-to-feature import while maintaining one globally
versioned IndexedDB database. See
[ADR-0010](../adr/ADR-0010-indexeddb-schema-composition.md).

## Enforcement

Two automated checks protect the source graph:

1. [`eslint.config.js`](../../eslint.config.js) applies typed ESLint plus
   restricted import patterns.
2. [`tests/architecture/importBoundaries.test.ts`](../../tests/architecture/importBoundaries.test.ts)
   scans every TypeScript source import independently of editor lint behavior.

Both reject:

- `@/features/<feature>/...` deep imports across a feature boundary;
- any non-`app` source module importing `@/app/...`;
- Platform importing a feature;
- Domain or Application importing React, WXT, Zustand, Dexie, Platform,
  Infrastructure or Presentation.

Examples of rejected dependencies:

```ts
// Domain depends on a UI framework.
import { useState } from 'react';

// Application selects a concrete repository.
import { DexieSessionRepository } from '../infrastructure/DexieSessionRepository';

// Platform becomes business-aware.
import { type Workflow } from '@/features/workflow';

// Consumer bypasses another feature's public API.
import { type Session } from '@/features/session/domain/Session';

// Lower module reaches into composition.
import { ChromeSessionClient } from '@/app/session/ChromeSessionClient';
```

Run both enforcement paths after boundary changes:

```bash
pnpm vitest run tests/architecture/importBoundaries.test.ts
pnpm lint
```

## Change Checklist

Before adding a module or import:

1. Name the business or runtime owner.
2. Decide whether the behavior is Domain, Application, Infrastructure,
   Presentation, Platform or composition.
3. Cross features only through a root `index.ts`.
4. Define a port inward before selecting a concrete outward adapter.
5. Keep browser calls in an ADR-0008-approved adapter owner.
6. Add to Shared Kernel only after ownership review.
7. Extend automated enforcement when a new class of invalid dependency becomes
   possible.

Do not weaken TypeScript, lint or architecture tests to make a dependency fit.
If the correct direction is impossible, the ownership model needs review.
