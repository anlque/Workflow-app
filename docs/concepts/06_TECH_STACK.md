# Purpose

This document defines the technologies used by the project together with the reasoning behind their selection.

Unlike the Design Principles document, which describes technology-independent engineering philosophy, this document records the concrete tools chosen to implement that philosophy.

The purpose of this document is not simply to list technologies.

Its purpose is to explain why each technology was selected, what problem it solves and under which circumstances it may be replaced.

Technology choices should always support the project's architecture, engineering principles and long-term maintainability.

Whenever possible, technologies should be selected based on measurable advantages rather than popularity or short-term trends.

# Technology Selection Principles

Technology should serve the architecture rather than define it.

Tools are replaceable.

Engineering principles are not.

Every technology introduced into the project should satisfy a clear engineering need.

New dependencies should be evaluated carefully because every dependency increases long-term maintenance cost.

The preferred technology is not necessarily the newest one, but the one that best satisfies the project's technical and business requirements.

The project favors mature, well-maintained technologies with predictable release cycles and strong TypeScript support.

Whenever two technologies provide similar value, preference should generally be given to the simpler solution with fewer dependencies and a smaller maintenance burden.

A dependency should be introduced only when it provides substantially more value than implementing the required functionality internally.

Likewise, functionality that is already well solved by mature community libraries should not be reimplemented without a compelling reason.

Technology choices should prioritize:

- correctness;
- maintainability;
- stability;
- developer experience;
- ecosystem maturity;
- long-term support;
- interoperability with the existing architecture.

Popularity alone should never justify adopting a technology.

# Core Technology Stack

The following technologies form the core implementation stack of the project.

Each technology is selected intentionally to support the project's architectural principles, long-term maintainability and developer experience.

Technology choices should remain pragmatic rather than ideological.

Whenever a technology no longer satisfies the project's needs, it may be replaced without changing the surrounding architecture.

Each technology described below should answer five questions:

- What problem does it solve?
- Why was it selected?
- Which alternatives were considered?
- What trade-offs does it introduce?
- Under what circumstances should it be replaced?

The stack should evolve gradually as the project evolves.

Replacing a technology should be considered an architectural decision rather than a routine implementation detail.

## Language

### Primary Technology

TypeScript (Strict Mode)

### Purpose

TypeScript provides static type checking, expressive modeling of the business domain and a significantly safer development experience than plain JavaScript.

It serves as the primary tool for expressing business concepts, preventing invalid states and improving long-term maintainability.

### Why TypeScript

The project places a strong emphasis on:

- correctness;
- explicit domain modeling;
- refactoring safety;
- predictable evolution;
- developer experience.

TypeScript directly supports these goals through its powerful type system.

Strict type checking significantly reduces runtime errors while improving IDE support and code navigation.

The language also enables the project to model complex business concepts using expressive domain types rather than relying on primitive values.

### Configuration Principles

The project adopts the strictest practical TypeScript configuration.

Compiler checks should prevent incorrect code from compiling whenever possible.

Relaxing compiler rules should be considered only when a clear engineering justification exists.

Type safety is treated as a design principle rather than merely a compiler feature.

### Alternatives Considered

JavaScript was rejected because it provides insufficient compile-time guarantees for a long-lived project of this complexity.

### Trade-offs

TypeScript introduces:

- additional compilation;
- more explicit type definitions;
- increased learning curve.

These costs are considered acceptable given the substantial improvements in maintainability and correctness.

### Replacement Criteria

TypeScript should be replaced only if another language provides significantly stronger guarantees while remaining compatible with the project's architecture, ecosystem and developer experience.

Such a replacement would constitute a major architectural decision.

## Runtime Environment

### Primary Technology

Chrome Extension Manifest V3

### Purpose

Manifest V3 provides the execution environment for the application.

It defines the lifecycle of the extension, available browser APIs, security model and communication between execution contexts.

The runtime environment serves as the foundation upon which all other technologies operate.

### Why Manifest V3

The application is designed as a browser extension intended to integrate seamlessly into the user's daily workflow.

Manifest V3 is the modern extension platform officially supported by Chromium-based browsers and provides significant improvements in security, performance and permission management.

Its event-driven architecture aligns well with the project's emphasis on explicit ownership, predictable execution and efficient resource usage.

### Configuration Principles

The application should:

- request the minimum required permissions;
- avoid unnecessary background execution;
- isolate responsibilities across runtime contexts;
- communicate through explicit message contracts;
- treat browser APIs as infrastructure rather than business logic.

The runtime environment should remain an implementation detail behind well-defined abstractions whenever practical.

### Alternatives Considered

Alternative desktop technologies, such as Electron or Tauri, were considered.

While they provide greater flexibility, they require substantially more resources and increase distribution complexity.

A browser extension better supports the project's goal of reducing friction between intention and focused work.

### Trade-offs

Manifest V3 introduces several constraints:

- service workers have limited lifetimes;
- browser APIs are asynchronous;
- execution is distributed across multiple contexts;
- extension permissions require careful management.

These constraints are considered acceptable given the benefits of native browser integration.

### Replacement Criteria

The runtime environment should be reconsidered only if browser extensions no longer provide the capabilities required by the product.

Potential future targets may include desktop or mobile applications.

Such expansion should preserve the project's architecture and business model rather than requiring a complete redesign.

## Build System

### Primary Technology

Extension Framework: WXT

Underlying Build Tool: Vite

### Purpose

The build system is responsible for transforming source code into production-ready extension bundles.

It orchestrates compilation, module resolution, asset processing, development server behavior, optimization and production builds.

The build system should remain fast, predictable and minimally intrusive to everyday development.

### Why Vite

The project prioritizes rapid feedback during development and minimal configuration complexity.

Vite provides:

- extremely fast startup;
- near-instant Hot Module Replacement;
- excellent TypeScript support;
- first-class ES Modules support;
- mature plugin ecosystem;
- straightforward configuration.

Its architecture aligns well with the project's emphasis on simplicity, maintainability and developer experience.

For a browser extension, Vite offers an excellent balance between performance, ecosystem maturity and long-term maintainability.

### Configuration Principles

The build configuration should:

- remain explicit;
- avoid unnecessary plugins;
- minimize custom build logic;
- isolate environment-specific configuration;
- support deterministic builds;
- use path aliases consistently;
- enable strict source maps during development.

Custom build steps should only be introduced when they provide clear value.

### Alternatives Considered

Webpack was rejected due to its significantly higher configuration complexity and slower development experience.

Rspack and Turbopack were considered promising alternatives but were not selected because ecosystem maturity and browser extension support remain less proven.

Parcel was rejected because it provides less explicit control over the build process.

### Trade-offs

Vite introduces:

- dependence on its production bundler ecosystem; the current Vite 8 dependency
  tree uses Rolldown;
- occasional plugin compatibility considerations;
- some browser extension integrations requiring dedicated plugins.

These trade-offs are acceptable given the substantial improvements in development speed and simplicity.

### Architectural Role

The build system belongs entirely to the Infrastructure layer.

Application code must remain independent of build tooling.

Changing the build system should not require changes to business logic.

### Replacement Criteria

The build system should be reconsidered only if another solution provides clear improvements in:

- development speed;
- ecosystem maturity;
- browser extension support;
- long-term maintainability;
- build reliability.

Migration should preserve the project's architecture and require minimal application-level changes.

## User Interface

### Primary Technology

React 19

### Purpose

React provides the component model used to implement the application's Presentation layer.

It is responsible for rendering interactive interfaces across the extension's visual runtime contexts, including:

- side panel;
- options page;
- full-page focus view;
- future onboarding and marketplace interfaces.

React must remain a presentation technology.

Domain rules, workflow execution and persistence must not depend on React.

### Why React

React was selected because it provides:

- a mature and stable component model;
- strong TypeScript integration;
- a large ecosystem;
- excellent testing support;
- predictable composition patterns;
- broad developer familiarity;
- compatibility with browser extension environments.

The application contains several interactive interfaces that share UI primitives and presentation behavior.

React's compositional model allows these interfaces to reuse components without coupling the Domain or Application layers to the view technology.

### Configuration Principles

React code should:

- use function components;
- keep state local whenever practical;
- separate presentation logic from business rules;
- prefer composition over highly configurable monolithic components;
- use semantic HTML;
- preserve accessibility by default;
- avoid effects when behavior can be expressed declaratively;
- introduce memoization only when justified by measurement.

React components must not directly:

- access persistence engines;
- call Chrome APIs when a Platform adapter exists;
- implement domain invariants;
- instantiate concrete repositories;
- coordinate long-running workflow execution.

### Architectural Role

React belongs exclusively to the Presentation layer.

It may consume Application use cases, public Domain types and Shared UI modules.

The Domain and Application layers must remain independently testable without React.

### Alternatives Considered

Vue, Svelte, Solid and Preact were considered.

They provide capable component models and may offer smaller bundles or different reactivity models.

React was selected because its ecosystem maturity, testing support, developer familiarity and long-term maintainability best match the project's requirements.

### Trade-offs

React introduces:

- runtime and bundle overhead;
- potential unnecessary rendering;
- a need for disciplined effect and state management;
- ecosystem complexity.

These costs are acceptable because React remains isolated to the Presentation layer and provides substantial benefits for developing complex interactive interfaces.

### Replacement Criteria

React should be reconsidered only if another UI technology provides clear improvements in:

- maintainability;
- accessibility;
- bundle size;
- developer experience;
- ecosystem stability;
- extension compatibility.

Replacing React must not require changes to Domain or Application logic.

## Styling

### Primary Technologies

- semantic CSS classes;
- CSS Custom Properties;
- Tailwind CSS 4 build pipeline.

### Purpose

Semantic CSS classes in `src/styles/global.css` provide the current component
styling system. CSS Custom Properties provide reusable design tokens and support
dynamic values that are not known at build time. Tailwind CSS supplies the
configured build pipeline and generated base layers; utility classes may be used
when they improve clarity, but they are not the current ownership model for
component styles.

Together they enable:

- consistent visual language;
- rapid interface development;
- responsive layouts;
- reusable design tokens;
- user-configurable environments;
- dynamic themes.

### Why This Combination

The project contains multiple compact and highly interactive extension
interfaces. Semantic classes keep related component rules readable, CSS Custom
Properties centralize design tokens and dynamic Environment values, and the
Tailwind pipeline provides a compatible build-time CSS foundation without a
runtime styling dependency.

This combination offers:

- consistent spacing and typography;
- straightforward responsive behavior;
- strong Vite integration;
- build-time CSS generation;
- no runtime styling dependency.

The resulting output is ordinary static CSS and does not require remote code
execution, which is compatible with extension security constraints.

### CSS Custom Properties

CSS Custom Properties should represent:

- design-system colors;
- typography values;
- spacing tokens where appropriate;
- themes;
- user-selected background colors;
- runtime environment values;
- reusable animation parameters.

Dynamic user values must not be assembled into generated class names.

Preferred:

```tsx
<div
    className="focus-environment"
    style={{
        '--environment-background': backgroundColor,
    } as React.CSSProperties}
/>
```

Avoid:

```tsx
<div className={`background-${backgroundColor}`} />
```

Runtime values should be passed through CSS Custom Properties or inline styles
with narrowly defined responsibilities.

### Configuration Principles

Styling should:

- use design tokens rather than repeated literal values;
- maintain visible focus states;
- support reduced-motion preferences;
- preserve sufficient color contrast;
- remain responsive across extension surfaces;
- avoid deeply nested selectors;
- avoid arbitrary values when an existing token is appropriate;
- use semantic class names that identify the component or UI responsibility;
- keep the current shared visual system coherent when styles move closer to a
  feature.

Custom CSS remains appropriate for:

- complex animations;
- browser-specific behavior;
- pseudo-elements;
- reusable keyframes;
- styling that becomes less readable as utility classes.

### Component Abstraction

Repeated visual patterns should be extracted into reusable UI components rather
than copied as large groups of declarations or utilities.

Component variants should use explicit, type-safe APIs.

Class composition should remain readable and should not turn components into
unstructured collections of styling tokens.

### Architectural Role

CSS belongs to the Presentation layer. Tailwind belongs to build tooling.

CSS variables may also be exposed through the Shared design system.

Business logic must remain independent of styling technologies.

### Alternatives Considered

CSS Modules were considered because they provide strong style isolation and
familiar CSS authoring.

Vanilla Extract was considered for type-safe build-time styling.

CSS-in-JS solutions were rejected because they introduce runtime overhead and
additional complexity that is unnecessary for this project.

A Tailwind-only utility convention was not adopted because the current semantic
classes provide clearer ownership for the existing component styles. Tailwind
remains in the build pipeline without becoming a second mandatory component
styling convention.

### Trade-offs

The current combination introduces two styling mechanisms and therefore requires
a clear convention: semantic CSS remains the default, CSS Custom Properties own
tokens and runtime values, and Tailwind utilities are optional rather than a
second competing design system.

### Replacement Criteria

The styling stack should be reconsidered if it begins to:

- reduce readability;
- cause substantial duplication;
- create competing conventions;
- obstruct the design system;
- create unacceptable bundle or build complexity.

Replacing the styling pipeline must not affect Domain, Application or
Infrastructure code.

## State Management

### Primary Technologies

- React local state
- Zustand
- persistent repositories

### Purpose

State management is divided according to ownership and lifetime.

No single state-management technology should become the universal storage mechanism for the application.

The project distinguishes between:

- local presentation state;
- shared runtime state;
- persistent business data;
- cross-context execution state.

### State Categories

#### Local Presentation State

React local state should be used for state owned by a single component tree.

Examples include:

- open dialogs;
- selected tabs;
- temporary form values;
- local validation visibility;
- expanded interface sections.

Local state is the default choice.

#### Shared Runtime State

Zustand should be used for transient state shared by multiple presentation modules within one runtime context.

Examples include:

- currently selected Workflow;
- active Session presentation state;
- timer display state;
- temporary editor coordination;
- runtime notification state.

Zustand must not become the permanent database of the application.

#### Persistent State

Workflows, Session records, Asset metadata and application settings belong in
persistent repositories. Reward Dice Templates are future scope.

Persistent state must not rely solely on a Zustand store.

### Why Zustand

Zustand was selected because it provides:

- a small API;
- minimal boilerplate;
- TypeScript support;
- selector-based subscriptions;
- React-bound and standalone stores;
- straightforward testing;
- no mandatory reducers, actions or providers.

Its lightweight model fits the project's incremental-complexity principle.

The application does not currently require the extensive conventions and ecosystem provided by Redux Toolkit.

### Runtime Context Limitation

Extension runtime contexts do not share the same JavaScript memory.

A Zustand store instantiated in one extension surface is not the same store as
one instantiated in the side panel, focus view or background service worker.

Cross-context state must be coordinated through:

- typed messaging;
- persistent storage;
- explicit synchronization events.

Zustand must never be treated as a cross-context communication mechanism.

### Configuration Principles

Zustand stores should:

- remain small and cohesive;
- represent one clear responsibility;
- expose explicit actions;
- use selectors to avoid unnecessary subscriptions;
- avoid duplicated persistent data;
- avoid embedding infrastructure clients;
- remain independent from React when React coupling is unnecessary.

Business rules should remain in Domain or Application modules.

Stores may coordinate presentation behavior but must not replace use cases.

### Store Boundaries

Prefer several focused stores over one global application store.

Good examples:

- ActiveSessionStore;
- WorkflowEditorStore;
- NotificationStore.

Avoid a single store containing unrelated state such as:

- workflows;
- settings;
- modal visibility;
- media blobs;
- authentication;
- notifications;
- service-worker lifecycle.

### Architectural Role

React local state and Zustand belong primarily to the Presentation layer.

A standalone store may be used by Application coordination when justified, but Domain entities and business rules must remain independent from Zustand.

Persistent repositories remain part of Application contracts and Infrastructure implementations.

### Alternatives Considered

Redux Toolkit was considered because it provides strong conventions, excellent developer tools and predictable state transitions.

It was not selected for the initial implementation because the project does not require its additional structure and boilerplate.

Jotai was considered for atomic state composition, but Zustand better matches the project's store-oriented runtime model.

React Context alone was rejected as the primary shared-state solution because frequent updates can create broad subscriptions and complex provider hierarchies.

### Trade-offs

Zustand introduces:

- fewer enforced conventions than Redux;
- the risk of oversized stores;
- the possibility of placing business logic in state actions;
- no automatic synchronization between extension contexts.

These risks must be controlled through architectural boundaries, focused stores and code review.

### Replacement Criteria

Zustand should be reconsidered if the application develops requirements such as:

- complex event history;
- extensive state debugging;
- large-team state conventions;
- advanced normalized client data;
- broad middleware requirements;
- increasingly complex cross-feature coordination.

A replacement must preserve the separation between runtime state, persistent data and Domain logic.

## Extension Framework

### Primary Technology

WXT

### Purpose

WXT provides the browser-extension-specific development and build infrastructure of the project.

It manages:

- extension entry points;
- Manifest V3 generation;
- extension pages;
- background service workers;
- development mode;
- browser-specific builds;
- extension packaging.

WXT operates on top of the project's TypeScript, React and Vite-based tooling.

### Why WXT

Vite provides general-purpose frontend build tooling but does not natively model browser-extension runtime contexts.

Without an extension framework, the project would need to maintain custom infrastructure for manifests, entry points, development reloads, packaging and browser-specific output.

WXT was selected because it provides:

- first-class support for browser extensions;
- Manifest V3 support;
- React integration;
- Vite-compatible tooling;
- file-based extension entry points;
- development reload behavior;
- extension packaging;
- support for multiple browsers;
- reduced custom build configuration.

It allows the project to focus on product behavior rather than maintaining extension build infrastructure.

### Configuration Principles

WXT configuration should:

- remain minimal and explicit;
- request only required permissions;
- keep entry points thin;
- preserve the project's existing architectural boundaries;
- avoid placing business logic inside WXT-specific files;
- isolate browser-specific behavior behind Platform adapters;
- avoid unnecessary WXT modules or auto-import features.

WXT entry points belong to the application's composition layer.

They may bootstrap features and register infrastructure, but they must not contain domain rules.

### Relationship with Vite

WXT is the extension framework.

Vite remains the underlying frontend build tool.

The distinction is:

```text
WXT
→ understands browser-extension structure and lifecycle

Vite
→ transforms, bundles and optimizes source code
```

Application code should not depend directly on either tool.

### Alternatives Considered

A custom Vite configuration was considered.

It was rejected because it would require maintaining extension-specific entry points, manifest generation, development reload behavior and packaging manually.

CRXJS was considered because it provides Manifest V3 integration and HMR through a Vite plugin.

WXT was selected because it provides a more complete browser-extension development framework, including project conventions, browser targeting and packaging.

Plasmo was considered but not selected because the project prefers a lightweight, explicit architecture with less framework-owned application structure.

### Trade-offs

WXT introduces:

- framework-specific conventions;
- an additional abstraction above Vite;
- some coupling to its entry-point and configuration model;
- reliance on a third-party extension framework.

These costs are acceptable because extension build infrastructure is not a core product capability and should not be implemented manually without a compelling reason.

### Architectural Role

WXT belongs to build tooling and the application composition layer.

Domain, Application and feature Presentation modules must remain independent of WXT-specific APIs.

### Replacement Criteria

WXT should be reconsidered if:

- it no longer supports required browser APIs or targets;
- its conventions conflict materially with the project architecture;
- maintenance or ecosystem support declines;
- native browser tooling or another framework provides substantially better reliability.

Replacing WXT must not require changes to Domain or Application logic.

---

## Persistence & Offline Strategy

### Primary Technologies

- Dexie
- IndexedDB
- chrome.storage.local

### Purpose

The application is designed to operate correctly without network connectivity.

Persistence provides durable storage for application data while preserving the separation between business logic and storage technologies.

External services enhance the experience but are never required for the core functionality.

### Storage Responsibilities

The application intentionally separates persistent data by purpose.

**IndexedDB (via Dexie)** stores structured application data such as:

- Workflows;
- active and historical Session records;
- local Asset metadata and blobs.

**chrome.storage.local** stores lightweight extension preferences such as:

- theme;
- reduced-motion preference;
- last selected workflow.

Every IndexedDB schema change has an ordered Dexie migration. Data read from
either store is validated at the Infrastructure boundary before mapping to
Domain values. Repository operations that update multiple records use a single
transaction.

Session timing persists wall-clock anchors rather than decrementing counters.
The background service worker uses Chrome alarms as wake-up signals and derives
the current state from persisted timestamps after suspension or restart.

### Storage Principles

Persistent storage should:

- remain transparent to the Domain layer;
- be accessed only through repository abstractions;
- support deterministic schema migrations;
- validate external data before use;
- avoid storing unnecessary derived data.

Business logic must never depend directly on Dexie or Chrome Storage APIs.

### Offline First

The application is designed as an offline-first experience.

Core functionality must remain fully available without network connectivity.

Future cloud synchronization, media providers and marketplace integrations should extend the application rather than become architectural requirements.

For this project, local-first means local persistence is authoritative and the
MVP has no network dependency. Offline-first describes the resulting runtime
capability; it is not a separate data-ownership model.

### Architectural Role

Persistence belongs to the Infrastructure layer.

Application and Domain layers communicate through repository contracts rather than storage implementations.

### Replacement Criteria

Storage technologies may be replaced if they provide significant improvements in reliability, scalability or platform compatibility.

Such changes should not require modifications to Domain or Application logic.

---

## Testing

### Primary Technologies

- Vitest
- React Testing Library
- Playwright

MSW may be introduced when external integrations require network-boundary
tests. It is not an installed MVP dependency.

### Purpose

Testing provides confidence that the application behaves correctly while remaining maintainable as it evolves.

Each testing technology serves a distinct purpose within the overall testing strategy.

### Testing Strategy

The project favors a testing pyramid.

```
           End-to-End
          Playwright

      Integration Tests
React Testing Library

       Unit Tests
          Vitest
```


Most tests should remain fast, deterministic and independent of browser infrastructure.

### Responsibilities

**Vitest**

- Domain logic
- Application services
- Utilities
- Pure functions

**React Testing Library**

- User interactions
- Component behavior
- Accessibility
- Integration between UI and application layer

**Playwright**

- Complete user journeys
- Extension runtime
- Side panel document
- Options page
- Focus view
- Background communication

**MSW (future)**

- Mock external services
- Future provider integrations
- Marketplace
- Cloud synchronization

### Testing Principles

Tests should:

- verify observable behavior;
- remain deterministic;
- avoid implementation details;
- execute quickly;
- isolate external dependencies;
- clearly communicate failures.

The lowest testing level capable of verifying a requirement should be preferred.

### Architectural Role

Testing tools belong exclusively to the development environment.

Production code must remain testable without introducing test-specific behavior.

### Replacement Criteria

Testing technologies may evolve independently provided the overall testing strategy remains unchanged. 

---

## Developer Tooling

### Primary Technologies

- pnpm
- ESLint
- Prettier
- GitHub Actions

### Purpose

Developer tooling promotes consistency, automation and code quality throughout the development lifecycle.

These tools automate repetitive tasks and help enforce the project's engineering standards.

### Responsibilities

**pnpm**

Package management.

**ESLint**

Static code analysis.

**Prettier**

Consistent code formatting.

**GitHub Actions**

Continuous Integration.

### Configuration Principles

Developer tooling should:

- execute automatically whenever practical;
- fail early;
- remain fast;
- require minimal manual configuration;
- produce deterministic results.

Manual enforcement should be replaced by automation whenever possible.

### Architectural Role

Developer tooling belongs entirely to the development process.

Application code must remain independent of development tools.

---

## Versioning Strategy

Technology versions should remain reasonably current while prioritizing stability over novelty.

Major upgrades should be introduced deliberately and validated before adoption.

Dependencies should be updated incrementally rather than through infrequent large migrations.

Deprecated libraries should be replaced before they become unsupported.

Experimental technologies should not become production dependencies unless they provide clear long-term value.

---

# Summary

The selected technology stack reflects the project's engineering principles rather than defining them.

Technologies may evolve as the project grows.

The architecture, domain model and design principles should remain stable even when individual tools are replaced.

Every technology included in this document has been selected because it supports one or more of the project's primary goals:

- correctness;
- maintainability;
- simplicity;
- developer experience;
- scalability;
- long-term sustainability.

Technology decisions should continue to be guided by these goals throughout the lifetime of the project.
