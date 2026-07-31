# Folder Structure

---

# Contents

- Purpose
- Architectural Approach
- Top-Level Project Structure
- Feature Module Structure
- Shared Modules
- Platform Modules
- Public APIs
- Import Rules
- Naming Conventions
- Growth Strategy
- Summary

---

# Purpose

This document defines the physical organization of the project's source code.

It describes how architectural principles are translated into folders, modules and public APIs.

The folder structure exists to make the architecture easy to understand, maintain and extend.

---

# Architectural Approach

The project follows a lightweight feature-first layered architecture.

The goal is to organize the code around business capabilities while maintaining clear architectural boundaries and avoiding unnecessary complexity.

The architecture combines ideas from Domain-Driven Design (DDD), Clean Architecture and modular feature-based organization, while intentionally avoiding the excessive structural complexity of frameworks such as Feature-Sliced Design (FSD).

Each feature represents a single business capability and may contain only the layers it actually requires.

Typical layers include:

- Domain
- Application
- Presentation
- Infrastructure

Layers are created only when they have a clear responsibility. Features are not required to contain every layer.

This approach provides:

- clear separation of responsibilities;
- low coupling between business capabilities;
- high cohesion within each feature;
- framework-independent business logic;
- scalable project organization;
- minimal architectural overhead.

The project intentionally does not follow the classical MVC pattern.

While MVC provides a simple separation between Model, View and Controller, modern React applications naturally blur the boundary between View and Controller, and Chrome Extensions introduce multiple runtime contexts that are not well represented by MVC.

Instead, the project separates responsibilities according to business concerns:

- Domain contains business entities, value objects and business rules.
- Application coordinates use cases and application workflows.
- Presentation contains the user interface and presentation logic.
- Infrastructure integrates external systems, browser APIs and persistence.

This architecture keeps the domain independent from React, Chrome APIs, storage implementations and other infrastructure concerns, allowing the application to evolve without affecting the core business model.

---

# Top-Level Project Structure

The project is organized around business capabilities rather than technical implementation details.

Each top-level directory has a single, well-defined responsibility.

```text
src/
│
├── app/
├── features/
├── platform/
├── shared/
├── assets/
└── styles/
```

## Terminology

The project intentionally distinguishes between:

- `features/assets/` — business functionality responsible for managing reusable domain Assets.
- `assets/` — static resources bundled with the application.

Although both relate to media, they serve different purposes and should not be confused.

---

## app/

The `app` directory contains the application's entry points and composition root.

It is responsible for bootstrapping the application, registering dependencies and connecting feature modules.

Typical contents include:

- side panel
- options page
- background service worker
- full-page focus view

WXT requires physical entry points under its configured `entrypoints/`
directory. Those files are thin adapters that delegate immediately to the
composition modules in `app/`; they do not create a second architectural layer.

Business logic should never be implemented inside `app`.

---

## features/

The `features` directory contains the application's business capabilities.

Each feature represents a single area of business functionality and is developed independently from other features.

Initial MVP features are:

- workflow
- session
- assets
- settings

Workflow owns Phase, Environment and Reward Dice configuration. Workflow Library
is the Workflow collection exposed by the workflow feature rather than a
separate feature. Session consumes an immutable Workflow snapshot through the
workflow public API. Reward Dice Templates, statistics and provider integrations
are future modules and must not be scaffolded for the MVP.

Features should communicate only through their public APIs.

---

## platform/

The `platform` directory contains adapters to the execution environment.

It provides access to browser APIs, persistence mechanisms and external services.

MVP examples include:

- Chrome APIs
- messaging
- storage
- notifications
- logging

Platform contains infrastructure code only.

It must never contain business logic.

---

## shared/

The `shared` directory contains reusable modules that are independent of any business capability.

Possible feature examples include:

- reusable UI components
- utility libraries
- shared hooks
- common types
- constants
- testing utilities

Business concepts such as `Workflow`, `Session` or `Reward Dice` must never be placed inside `shared`.

---

## assets/

The `assets` directory contains static resources bundled with the application.

Typical examples include:

- icons
- fonts
- images
- localization resources

This directory stores application resources only.

It must not be confused with the domain concept of reusable media assets.

---

## styles/

The `styles` directory contains global styling resources shared across the application.

Typical examples include:

- global styles
- CSS variables
- reset styles
- typography

Feature-specific styles should remain inside their corresponding feature modules whenever practical.

---

# Feature Module Structure

Each business capability is implemented as an independent feature module.

A feature represents one cohesive area of application behavior.

Typical examples include:

- workflow;
- session;
- assets;
- settings;

Phase, Environment and Reward Dice remain inside `workflow` because they are
owned by the Workflow aggregate. They must not be split into independent
features merely because they have distinct UI or Domain types.

Each feature may contain the following internal layers:

```text
feature-name/
│
├── domain/
├── application/
├── presentation/
├── infrastructure/
└── index.ts
```

A feature should contain only the layers it actually requires.

Empty directories must not be created in advance.

---

## domain/

The `domain` directory contains business concepts and business rules owned by the feature.

Typical contents include:

- entities;
- value objects;
- domain services;
- business validations;
- domain-specific types;
- domain errors.

Domain code must remain framework-independent.

It must not depend on:

- React;
- state-management libraries;
- browser APIs;
- storage implementations;
- network clients;
- UI components.

Example:

```text
workflow/
└── domain/
    ├── Workflow.ts
    ├── Phase.ts
    ├── Environment.ts
    └── WorkflowErrors.ts
```

---

## application/

The `application` directory contains use cases that coordinate domain behavior.

It defines what the application can do with the feature.

Typical contents include:

- commands;
- queries;
- use cases;
- application services;
- repository contracts;
- external service contracts;
- application-specific result types.

Application code may depend on the feature's Domain layer.

It must not depend directly on concrete infrastructure implementations.

Example:

```text
workflow/
└── application/
    ├── createWorkflow.ts
    ├── updateWorkflow.ts
    ├── deleteWorkflow.ts
    ├── getWorkflow.ts
    └── WorkflowRepository.ts
```

---

## presentation/

The `presentation` directory contains user-interface code and presentation logic.

Typical contents include:

- React components;
- feature-specific hooks;
- view models;
- form models;
- UI state;
- presentation mappers.

Presentation may depend on the Application layer and on reusable modules from `shared`.

Presentation must not contain domain rules.

Example:

```text
workflow/
└── presentation/
    ├── WorkflowEditor.tsx
    ├── WorkflowList.tsx
    ├── useWorkflowEditor.ts
    └── WorkflowFormModel.ts
```

---

## infrastructure/

The `infrastructure` directory contains concrete adapters required by the feature.

Typical contents include:

- repository implementations;
- persistence mappers;
- serializers;
- external service adapters;
- provider-specific implementations.

Infrastructure may implement contracts defined by the Application layer.

It may use common environment adapters from `platform`.

Example:

```text
workflow/
└── infrastructure/
    ├── DexieWorkflowRepository.ts
    ├── WorkflowRecord.ts
    └── mapWorkflowRecord.ts
```

Feature infrastructure must not be imported directly by Presentation.

Concrete implementations are connected through the application's composition root.

---

## index.ts

Every feature exposes a single public API through its root `index.ts`.

Only modules intended for external use may be exported.

Example:

```ts
export { WorkflowEditor } from './presentation/WorkflowEditor';
export { createWorkflow } from './application/createWorkflow';
export type { Workflow } from './domain/Workflow';
```

Other modules must not import internal feature files directly.

Allowed:

```ts
import { WorkflowEditor } from '@/features/workflow';
```

Prohibited:

```ts
import { WorkflowEditor } from '@/features/workflow/presentation/workflow-editor';
```

---

## Internal Organization

Additional directories may be introduced inside a layer when its size justifies further organization.

For example:

```text
workflow/
└── presentation/
    ├── components/
    ├── hooks/
    ├── models/
    └── mappers/
```

Such directories must reflect clear responsibilities.

Generic directories such as the following should be avoided:

- utils;
- helpers;
- common;
- misc.

---

## Feature Boundary Rules

A feature owns its internal implementation.

Other features may access it only through its public API.

A feature must not import internal files from another feature.

Cross-feature dependencies should remain explicit and minimal.

If two features require the same business-independent code, that code may be extracted into `shared`.

If they require the same business concept, the ownership of that concept must be clarified rather than moving it automatically into `shared`.

---

## Example

A complete MVP Workflow feature may look like this:

```text
features/
└── workflow/
    ├── domain/
    │   ├── Workflow.ts
    │   ├── Phase.ts
    │   ├── RewardDice.ts
    │   └── rollReward.ts
    │
    ├── application/
    │   ├── createWorkflowUseCase.ts
    │   └── WorkflowRepository.ts
    │
    ├── presentation/
    │   ├── WorkflowEditor.tsx
    │   └── useWorkflowEditor.ts
    │
    ├── infrastructure/
    │   └── DexieWorkflowRepository.ts
    │
    └── index.ts
```

The structure may be smaller when the feature has fewer responsibilities.

Architectural consistency is more important than structural symmetry.

---

# Shared Modules

The `shared` directory contains reusable modules that are completely independent of any specific business capability.

A module belongs in `shared` only if it can be reused without any knowledge of the application's domain.

Shared modules should remain stable and generic.

---

## Typical Contents

Examples include:

- reusable UI components;
- utility libraries;
- browser-independent helpers;
- common hooks;
- design system;
- theme;
- shared types;
- constants;
- testing utilities.

Example structure:

```text
shared/
│
├── ui/
├── lib/
├── hooks/
├── types/
├── constants/
├── theme/
└── testing/
```

---

## What Does NOT Belong in Shared

Business concepts must never be placed inside `shared`.

Examples include:

- Workflow;
- Session;
- Phase;
- Environment;
- Reward Dice;
- Media;
- Statistics.

These concepts belong to their owning feature.

---

## Reuse Is Not Enough

Being reused does not automatically justify moving code into `shared`.

A module should be moved only if it is:

- reusable;
- business-independent;
- conceptually generic.

For example:

Good candidates:

- debounce;
- date formatting;
- modal component;
- button component;
- keyboard shortcuts.

Poor candidates:

- workflow validator;
- reward dice calculator;
- session timer.

---

## Shared UI

Reusable UI components should remain completely independent from business logic.

Good examples include:

- Button;
- Dialog;
- Checkbox;
- Select;
- Tooltip.

Business-specific components should remain inside their corresponding feature.

For example:

Allowed:

```text
shared/ui/button/
```

Not allowed:

```text
shared/ui/workflow-editor/
```

---

## Shared Libraries

Utility libraries should be organized by responsibility rather than by miscellaneous collections.

Preferred:

```text
shared/lib/
├── date/
├── string/
├── math/
├── browser/
└── validation/
```

Avoid generic directories such as:

- utils;
- helpers;
- common;
- misc.

---

## Shared Types

Shared types should represent generic concepts only.

Examples include:

- Nullable;
- Result;
- DeepReadonly;
- AsyncValue.

Business entities must remain inside their owning feature.

---

## Design Principles

Shared exists to reduce duplication without introducing coupling.

Moving code into `shared` should make the project simpler.

If moving code makes ownership less obvious, the code should remain inside its feature.

---

## Design Principles

The top-level project structure follows several important rules.

- Every directory has a single responsibility.
- Business capabilities are organized inside `features`.
- Environment-specific code belongs to `platform`.
- Reusable framework-independent code belongs to `shared`.
- Application composition belongs to `app`.
- Static resources belong to `assets`.
- Global styling belongs to `styles`.

The top-level structure should remain stable as the project grows.

---

# Platform Modules

The `platform` directory contains reusable adapters to the application's execution environment.

Platform modules provide access to browser capabilities, persistence mechanisms and external systems.

They translate technology-specific APIs into stable interfaces that can be consumed by feature infrastructure and the application composition root.

Platform contains no business rules.

---

## Typical Contents

Example structure:

```text
platform/
│
├── chrome/
├── messaging/
├── storage/
├── notifications/
├── media-providers/
├── logging/
└── serialization/
```

Platform modules should be organized by technical capability rather than by business feature.

---

## chrome/

The `chrome` directory contains low-level wrappers around Chrome Extension APIs.

Typical responsibilities include:

- tabs;
- alarms;
- commands;
- permissions;
- runtime lifecycle;
- extension URLs;
- side panel;
- context menus.

Direct access to `chrome.*` APIs outside `platform` should be avoided.

Preferred:

```ts
import { chromeTabs } from '@/platform/chrome';
```

Avoid:

```ts
chrome.tabs.query(...);
```

inside Presentation, Domain or Application code.

---

## messaging/

The `messaging` directory provides communication between extension runtime contexts.

Typical contexts include:

- side panel;
- options page;
- focus view;
- background service worker;

Popup and content-script contexts may be added after the MVP if a documented
requirement needs them.

Responsibilities may include:

- message contracts;
- request and response handling;
- runtime transport;
- validation;
- timeouts;
- error normalization.

Message contracts should be typed and explicit.

Messages should describe intent rather than implementation details.

Preferred:

```text
START_SESSION
```

Avoid:

```text
CALL_BACKGROUND_FUNCTION
```

---

## storage/

The `storage` directory contains reusable persistence primitives and storage-engine adapters.

Typical responsibilities include:

- IndexedDB access;
- Chrome Storage access;
- transactions;
- schema versioning;
- migrations;
- serialization;
- storage errors.

Platform storage modules must not know about domain concepts such as `Workflow` or `Session`.

Feature-specific repositories and persistence mappers remain inside feature infrastructure.

For example:

```text
platform/storage/IndexedDbClient.ts
```

may provide generic IndexedDB access, while:

```text
features/workflow/infrastructure/DexieWorkflowRepository.ts
```

implements workflow persistence.

---

## notifications/

The `notifications` directory provides adapters for system-level notifications and related browser capabilities.

It may handle:

- notification creation;
- notification permissions;
- notification actions;
- notification events.

It must not decide when a business notification should be sent.

That decision belongs to Application or Domain logic.

---

## media-providers/

The `media-providers` directory contains adapters for external media sources.

Typical examples include:

- image providers;
- audio providers;
- video providers;
- bundled media sources.

Provider-specific response formats must not leak into feature or domain code.

Platform adapters should normalize external data before exposing it to higher layers.

---

## logging/

The `logging` directory provides application-wide logging and diagnostics.

Typical responsibilities include:

- log levels;
- structured log records;
- runtime context information;
- error reporting;
- development diagnostics.

Business logic must not depend on a specific logging implementation.

---

## Platform Boundaries

Platform may depend on:

- browser APIs;
- storage libraries;
- external SDKs;
- shared business-independent modules.

Platform must not depend on:

- feature Presentation;
- feature Application use cases;
- domain entities for business decisions;
- application entry points.

Feature infrastructure may use Platform to implement application contracts.

---

## Direct Access Rule

Technology-specific APIs should be accessed through Platform adapters whenever isolation provides clear value.

This rule should not create wrappers that merely rename stable APIs without adding any boundary, normalization or testability benefit.

A Platform adapter is justified when it provides at least one of the following:

- runtime isolation;
- type-safe contracts;
- error normalization;
- data transformation;
- testability;
- lifecycle handling;
- compatibility between execution contexts.

---

## Design Principles

Platform isolates unstable technical details from stable business logic.

Replacing a storage engine, browser API wrapper or external provider should not require changes to the Domain layer.

Platform modules should remain reusable across features while staying completely business-independent.

---

# Public APIs

Every top-level module and every feature exposes a single public API.

The public API defines the only supported entry point for other modules.

Internal implementation details must remain private.

This approach provides:

- clear module boundaries;
- explicit dependencies;
- easier refactoring;
- improved discoverability;
- better encapsulation.

---

## Public Entry Point

Every feature should expose a root `index.ts` file.

Example:

```text
features/
└── workflow/
    ├── application/
    ├── domain/
    ├── infrastructure/
    ├── presentation/
    └── index.ts
```

Other modules should import only from this entry point.

Preferred:

```ts
import { WorkflowEditor } from '@/features/workflow';
```

Avoid:

```ts
import { WorkflowEditor } from '@/features/workflow/presentation/workflow-editor';
```

---

## What May Be Exported

The public API should expose only functionality intended for external use.

Typical exports include:

- public React components;
- application use cases;
- public hooks;
- public types;
- feature factories.

Internal implementation details should remain private.

Examples include:

- helper functions;
- internal mappers;
- implementation-specific hooks;
- persistence models;
- serializers.

---

## Stable Interface

The public API represents a stable contract between modules.

Internal implementation may change freely as long as the public API remains compatible.

Whenever possible, external modules should not be aware of the feature's internal directory structure.

---

## Feature Independence

A feature owns its implementation.

Other features should communicate only through the owning feature's public API.

Cross-feature imports into internal directories are prohibited.

---

## Shared Modules

Shared modules should also expose explicit public APIs whenever practical.

Example:

```text
shared/
└── ui/
    └── button/
        ├── button.tsx
        └── index.ts
```

Preferred:

```ts
import { Button } from '@/shared/ui/button';
```

Avoid exposing entire directories through wildcard exports unless they represent a stable public surface.

---

## Platform Modules

Platform modules should expose technology-independent interfaces whenever possible.

Consumers should depend on platform capabilities rather than implementation details.

For example:

```ts
import { storage } from '@/platform/storage';
```

instead of importing a concrete storage implementation directly.

---

## Design Principles

Every module should have a small, intentional and stable public surface.

The smaller the public API, the easier the module is to evolve without affecting the rest of the application.

---

# Import Rules

Import rules define the allowed dependency directions between application modules.

These rules protect architectural boundaries and prevent accidental coupling.

All dependencies must remain explicit, intentional and directed toward more stable modules.

---

## Top-Level Dependency Direction

The preferred dependency direction is:

```text
app
│
├── features
├── platform
└── shared

features
│
├── other feature public APIs
├── platform
└── shared

platform
└── shared

shared
```

Lower-level modules must never depend on higher-level modules.

---

## app Imports

The `app` layer acts as the composition root.

It may import:

- feature public APIs;
- platform public APIs;
- shared modules.

It is responsible for connecting concrete implementations, initializing runtime contexts and bootstrapping the application.

Other modules must not depend on `app`.

Allowed:

```ts
import { WorkflowEditor } from '@/features/workflow';
import { createStorage } from '@/platform/storage';
import { AppThemeProvider } from '@/shared/theme';
```

Prohibited:

```ts
import { bootstrapSidePanel } from '@/app/side-panel';
```

inside a feature, platform or shared module.

---

## Feature Imports

A feature may import:

- its own internal modules;
- public APIs of other features;
- platform public APIs;
- shared modules.

A feature must never import internal files from another feature.

Allowed:

```ts
import { startSession } from '@/features/session';
```

Prohibited:

```ts
import { sessionRepository } from '@/features/session/infrastructure/session-repository';
```

Cross-feature dependencies should remain minimal.

If two features depend heavily on each other, their boundaries should be reconsidered.

---

## Internal Feature Dependencies

Inside a feature, dependencies should follow this direction:

```text
presentation
      ↓
application
      ↓
domain

infrastructure
      ↓
application contracts
      ↓
domain
```

The Domain layer must not depend on any other feature layer.

The Application layer may depend on Domain.

Presentation may depend on Application and Domain types exposed for presentation needs.

Infrastructure may depend on Domain and contracts defined by Application.

---

## Domain Imports

Domain code may import only:

- other modules from the same Domain layer;
- carefully selected business-independent modules from `shared`.

Domain must not import:

- React;
- browser APIs;
- storage libraries;
- platform modules;
- Presentation;
- Infrastructure;
- concrete Application services;
- state-management libraries.

Prohibited:

```ts
import { useState } from 'react';
import { chromeStorage } from '@/platform/storage';
import { indexedDB } from 'some-storage-library';
```

---

## Application Imports

Application code may import:

- its feature's Domain layer;
- application contracts;
- business-independent shared modules;
- public domain contracts from another feature when necessary.

Application must not depend on:

- React components;
- presentation hooks;
- concrete repository implementations;
- browser APIs;
- storage engines.

Application defines required contracts.

Infrastructure provides their implementations.

---

## Presentation Imports

Presentation may import:

- its feature's Application layer;
- public Domain types;
- shared UI components;
- shared presentation utilities;
- public APIs of other features.

Presentation must not import:

- concrete feature infrastructure;
- storage engines;
- direct browser APIs when an adapter exists;
- internal files from another feature.

Prohibited:

```ts
import { IndexedDbWorkflowRepository } from '../infrastructure';
```

---

## Infrastructure Imports

Feature Infrastructure may import:

- its feature's Domain layer;
- contracts defined by its Application layer;
- platform modules;
- shared technical utilities.

Infrastructure must not import:

- Presentation;
- application entry points;
- React components;
- internal modules from unrelated features.

Infrastructure implements contracts but does not coordinate business use cases.

---

## Platform Imports

Platform may import:

- external libraries;
- browser APIs;
- business-independent shared modules;
- internal platform modules.

Platform must not depend on:

- features;
- feature domain entities;
- Presentation;
- app entry points.

Platform exposes generic technical capabilities.

Feature-specific interpretation belongs to feature Infrastructure.

---

## Shared Imports

Shared may import:

- other shared modules;
- external business-independent libraries.

Shared must never import:

- features;
- platform;
- app;
- domain entities;
- feature-specific types.

`shared` is the lowest and most reusable project layer.

It must remain independent from the application domain.

---

## Type Imports

Type-only dependencies should use explicit type imports.

Preferred:

```ts
import type { Workflow } from '@/features/workflow';
```

This makes runtime dependencies easier to understand and prevents accidental module initialization.

Type-only imports do not permit bypassing module boundaries.

Importing an internal type from another feature remains prohibited.

---

## Relative and Absolute Imports

Absolute aliases should be used for imports across module boundaries.

Preferred:

```ts
import { Button } from '@/shared/ui/button';
import { startSession } from '@/features/session';
```

Relative imports should be used only inside the same local module or feature area.

Preferred:

```ts
import { validateWorkflow } from './validate-workflow';
import { WorkflowForm } from '../components/workflow-form';
```

Deep relative imports that escape the owning module should be avoided.

Prohibited:

```ts
import { Button } from '../../../../shared/ui/button';
```

---

## Circular Dependencies

Circular dependencies are prohibited.

Examples include:

```text
workflow → session → workflow
```

or:

```text
application → infrastructure → application implementation
```

When a circular dependency appears, the shared contract should be moved to the module that owns the concept or introduced as an explicit boundary.

Circular dependencies must not be hidden through barrel files or dependency injection.

---

## Barrel Files

Barrel files may define intentional public APIs.

They must not be used to expose internal module trees automatically.

Preferred:

```ts
export { WorkflowEditor } from './presentation/workflow-editor';
export { createWorkflow } from './application/create-workflow';
export type { Workflow } from './domain/workflow';
```

Avoid:

```ts
export * from './domain';
export * from './application';
export * from './presentation';
```

---

## Architectural Violations

The following are considered architectural violations:

- importing another feature's internal files;
- importing `app` from any lower-level module;
- placing business logic inside `shared`;
- accessing Chrome APIs directly from Domain or Application;
- importing concrete Infrastructure into Presentation;
- making Platform depend on feature concepts;
- introducing circular dependencies;
- bypassing a module's public API;
- using type imports to bypass module ownership.

Such violations should be corrected rather than documented as exceptions.

---

## Enforcement

Import rules should be enforced automatically where practical.

Possible enforcement mechanisms include:

- ESLint import restrictions;
- TypeScript path aliases;
- dependency graph validation;
- circular dependency detection;
- architecture-focused tests.

Exact tools belong to the Tech Stack document.

The architectural rules remain independent from their enforcement implementation.

---

## Summary

Dependencies must point toward more stable and reusable modules.

Modules communicate through explicit public APIs.

Internal implementation remains private.

Architectural boundaries apply equally to runtime imports and type-only imports.

---

# Naming Conventions

Consistent naming improves readability, discoverability and long-term maintainability.

Naming should describe business concepts rather than implementation details.

---

## Directories

Directory names use **kebab-case**.

Preferred:

```text
reward-dice/
side-panel/
media-provider/
```

Avoid:

```text
RewardDice/
rewardDice/
Reward_Dice/
```

---

## Files

Filenames follow the primary exported symbol:

- modules whose primary export is a React component, Domain type, class or other
  PascalCase symbol use **PascalCase**;
- function-oriented and utility modules whose primary export is camelCase use
  **camelCase**;
- barrel files remain `index.ts`;
- test and mock filenames match the source module and add `.test`, `.spec` or
  `.mock` before the extension.

Preferred:

```text
Workflow.ts
WorkflowEditor.tsx
createWorkflow.ts
rollReward.test.ts
WorkflowRepository.mock.ts
```

Generic filenames such as `helpers.ts`, `utils.ts`, `common.ts` and `misc.ts`
remain prohibited. A filename must identify the concept or behavior it owns.

---

## React Components

Component filenames use **PascalCase** to match their primary exported symbol.

Exported component names use **PascalCase**.

Example:

```text
WorkflowEditor.tsx
```

```ts
export function WorkflowEditor() {}
```

---

## Hooks

Custom hooks begin with `use`.

Examples:

```text
useWorkflow.ts
useSession.ts
useRewardDiceEditor.ts
```

---

## Types

Types, interfaces and classes use **PascalCase**.

Examples:

```text
Workflow
Session
RewardDice
WorkflowRepository
```

---

## Functions

Function names use **camelCase**.

They should describe behavior using verbs.

Examples:

```text
createWorkflow()
startSession()
loadMedia()
calculateReward()
```

Avoid vague names such as:

```text
process()
handle()
execute()
doStuff()
```

unless their context makes the meaning obvious.

---

## Constants

Constants use **UPPER_SNAKE_CASE** only for true compile-time constants.

Examples:

```text
DEFAULT_SESSION_DURATION
MAX_DICE_SIDES
```

Configuration objects should use normal camelCase names.

---

## Module Names

Module names should represent business concepts whenever possible.

Preferred:

```text
workflow
session
reward-dice
statistics
```

Avoid technical names such as:

```text
manager
processor
helper
common
misc
```

---

## Design Principles

Names should communicate intent rather than implementation.

A reader should understand the responsibility of a module without opening its source code.
---

# Growth Strategy

The folder structure is designed to support long-term growth without requiring large-scale reorganization.

New functionality should normally be introduced by adding a new feature module.

Existing feature modules should rarely require modification.

When adding a new feature:

1. Create a new feature module.
2. Define its Domain, Application, Presentation and Infrastructure layers as needed.
3. Expose a public API through `index.ts`.
4. Register the feature in the application composition root.

Features should remain cohesive and focused on a single business capability.

If a feature grows too large, it should be decomposed into smaller collaborating features rather than introducing additional architectural layers.

The preferred evolution strategy is expansion through composition rather than increasing complexity within existing modules.

The top-level folder structure should remain stable throughout the lifetime of the project.

---

# Summary

The folder structure reflects the architectural principles defined by the project.

Business capabilities are the primary organizational unit.

Each module has a clear responsibility, explicit ownership and a minimal public surface.

Dependencies remain intentional and directional.

Features communicate through stable public APIs.

Platform isolates technology-specific concerns.

Shared contains only business-independent modules.

The structure is intentionally designed to remain understandable, maintainable and scalable as the project evolves.
