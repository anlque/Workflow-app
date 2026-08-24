# System Tour

This tour follows one user action from the browser shell into Flowarium and back
to rendered state. Keep the [Project Map](../development/PROJECT_MAP.md) open for
ownership details.

## 1. Start at a Browser Surface

Flowarium has four independent Chrome MV3 contexts:

- the non-visual background worker;
- the focus view in a normal browser tab;
- the Options page;
- the side panel.

Clicking the toolbar action reaches the background worker. Opening an extension
page reaches its own HTML document and JavaScript context. These contexts do not
share React roots, Zustand stores or module instances.

## 2. Enter Through WXT

WXT discovers the physical entries under [`entrypoints/`](../../entrypoints/):

| Browser context | WXT entry | Delegates to |
| --- | --- | --- |
| Background worker | [`background.ts`](../../entrypoints/background.ts) | `bootstrapBackground()` |
| Focus view | [`focus/main.tsx`](../../entrypoints/focus/main.tsx) | `bootstrapFocus()` |
| Options page | [`options/main.tsx`](../../entrypoints/options/main.tsx) | `bootstrapOptions()` |
| Side panel | [`sidepanel/main.tsx`](../../entrypoints/sidepanel/main.tsx) | `bootstrapSidePanel()` |

The entries are intentionally thin. WXT needs their physical location to build
the manifest and extension documents; architectural composition belongs in
[`src/app/`](../../src/app/).

## 3. Bootstrap One Context

Each React document resolves its own `#root` element and calls `createRoot`
inside the matching `bootstrap*` function. A separate root is required because
each surface is a separate HTML document, not because a single React tree is
being divided for navigation.

The background entry instead uses WXT's `defineBackground` and starts
[`bootstrapBackground()`](../../src/app/background/bootstrapBackground.ts). It
has no DOM and no React root.

## 4. Compose Dependencies at the Edge

The focus, Options and side-panel bootstraps call matching dependency factories:

- [`createFocusDependencies()`](../../src/app/focus/createFocusDependencies.ts);
- [`createOptionsDependencies()`](../../src/app/options/createOptionsDependencies.ts);
- [`createSidePanelDependencies()`](../../src/app/side-panel/createSidePanelDependencies.ts).

These factories create concrete repositories, browser adapters and use-case
closures, then pass a typed dependency object into the surface component. This
is where Flowarium is allowed to know both an inward Application contract and
its outward implementation.

The background bootstrap performs the same job directly: it composes the
database, repositories, clock, message bus and alarm scheduler into the Session
coordinator.

## 5. Discover a Feature Through Its Root API

Composition code imports a feature from its root, for example:

```ts
import {
  DexieWorkflowRepository,
  listWorkflowsUseCase,
  workflowDatabaseSchemas,
} from '@/features/workflow';
```

The supported boundary is the feature's `index.ts`:

- [`workflow/index.ts`](../../src/features/workflow/index.ts);
- [`session/index.ts`](../../src/features/session/index.ts);
- [`assets/index.ts`](../../src/features/assets/index.ts);
- [`settings/index.ts`](../../src/features/settings/index.ts).

Do not reach into another feature's `domain/`, `application/`,
`infrastructure/` or `presentation/` directory. Root exports make coupling
visible and allow internals to change without rewriting consumers.

## 6. Follow `session/start` Inward

Starting a Session from the focus view or side panel is the representative
cross-context path:

1. React calls the injected `start` or `startSession` dependency with a
   `WorkflowId`.
2. [`ChromeSessionClient`](../../src/app/session/ChromeSessionClient.ts) creates
   a command identifier and sends a `session/start` runtime message.
3. The background
   [`createSessionCoordinator`](../../src/app/background/createSessionCoordinator.ts)
   validates and handles that command.
4. The coordinator loads the Workflow through the `WorkflowRepository` port and
   calls Session Application behavior.
5. [`startSessionUseCase`](../../src/features/session/application/startSessionUseCase.ts)
   checks that no active Session exists, asks Domain to create an immutable
   Session snapshot and saves it through the `SessionRepository` port.
6. The injected Dexie repositories cross the persistence boundary through the
   shared `FlowariumDatabase`; the alarm adapter schedules the next wake-up.
7. The coordinator broadcasts `session/changed` after the authoritative change.
8. Each open Session surface receives the projection independently and replaces
   its local Zustand projection.

The important distinction is control flow versus dependency direction. A use
case calls a repository port at runtime, while the concrete repository imports
and implements the inward contract. Domain never imports Dexie, Chrome or React.

## 7. Project State Back to React

[`connectSessionMessages`](../../src/features/session/presentation/connectSessionMessages.ts)
subscribes before requesting the active Session, so a surface does not overwrite
a newer event with an older initial response. It places the parsed projection in
that document's `ActiveSessionStore`.

React renders from the local projection. It does not become the owner of active
Session execution: commands return to the background worker, and a refreshed or
newly opened surface asks the worker for current state again.

Workflow collection synchronization follows a separate invalidation path.
Successful mutations emit `workflow/catalog-changed`; open catalog hooks reload
from IndexedDB instead of receiving a copied Workflow payload. An already active
Session keeps its immutable snapshot.

## 8. Know Where Behavior Belongs

Use this placement test before changing code:

| Question | Owner |
| --- | --- |
| Is it a business invariant or valid state transition? | Feature `domain/` |
| Does it coordinate Domain behavior through ports? | Feature `application/` |
| Does it serialize, store or call an external mechanism? | Feature `infrastructure/` or `platform/` |
| Does it render or manage local UI state? | Feature `presentation/` |
| Does it wire a browser surface to concrete implementations? | `src/app/` |
| Is it genuinely shared by independent features? | Minimal `src/shared/` owner |

## 9. Use Names to Navigate

Files that primarily export components, Domain types or classes match that
symbol in PascalCase: `WorkflowEditor.tsx`, `Workflow.ts` and
`ChromeSessionClient.ts`. Functions, hooks and utilities use camelCase:
`createWorkflow.ts` and `useWorkflowCatalog.ts`.

This is deliberate. The filename convention reinforces
[One Concept — One Name](../concepts/07_CODING_STANDARDS.md#one-concept--one-name),
so searching for a concept normally finds its definition, public export and
tests under the same name.

## Next Reading

- Use the [Project Map](../development/PROJECT_MAP.md) as the current ownership
  lookup.
- Read the [Architecture](../concepts/03_ARCHITECTURE.md) and
  [Folder Structure](../concepts/04_FOLDER_STRUCTURE.md) for normative rules.
- Use the [ADR index](../adr/README.md) to understand why stable boundaries were
  chosen.
