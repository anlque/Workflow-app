# Workflow Feature

## Purpose

The Workflow feature owns reusable focus configuration. A Workflow is the
aggregate root for its ordered Phases, each Phase's Environment and its optional
Reward Dice. The feature also owns the repository-backed Workflow Library
collection, CRUD/reordering use cases, package import/export and reusable
Workflow presentation.

Source root: [`src/features/workflow/`](../../../src/features/workflow/).

## Owns

- `Workflow` identity, name and ordered non-empty Phase sequence;
- `Phase`, `Environment`, Reward Dice and Dice Side value semantics;
- Reward eligibility and weighted side selection;
- Workflow repository port and CRUD/list/order use cases;
- Workflow package contract, mapping, import/export and atomic unit-of-work port;
- Workflow record mapping, table ordering and Dexie adapters;
- Workflow Library, editor, Reward Dice editor and catalog/editor hooks;
- the root public API in
  [`index.ts`](../../../src/features/workflow/index.ts).

## Does Not Own

- active Session execution, timing, pause or completion;
- Asset identity semantics beyond the shared `AssetId` reference contract;
- Asset Blob lifecycle, MIME/size policy or deletion rules;
- Chrome runtime messaging or catalog-event transport;
- Options/focus/side-panel composition;
- Reward Dice Templates, marketplace data or remote providers.

The Workflow Library is the ordered repository-backed collection of local
Workflows. It is not a separately persisted Entity or aggregate.

## Public API

External consumers import only from `@/features/workflow`. The root currently
exports:

| Group | Exports |
| --- | --- |
| Domain value types | `DiceSide`, `DiceSideInput`, `AssetId`, `Environment`, `EnvironmentInput`, `DurationSeconds`, `Phase`, `PhaseInput`, `PhaseType`, `RewardDice`, `RewardDiceInput`, `RewardPhaseType`, `CreateWorkflowInput`, `Workflow`, `WorkflowId` |
| Domain behavior and errors | `createWorkflowId`, `createWorkflow`, `rollReward`, `isRewardDueAfterPhase`, `WorkflowValidationError` |
| Application contracts and errors | `WorkflowRepository`, `WorkflowApplicationError`, `WorkflowPackageV1`, `WorkflowPackageUnitOfWork`, `WorkflowPackageValidationError`, `WorkflowImportIdentity`, `WorkflowImportOptions` |
| Application use cases | `createWorkflowUseCase`, `deleteWorkflowUseCase`, `duplicateWorkflowUseCase`, `listWorkflowsUseCase`, `reorderWorkflowsUseCase`, `updateWorkflowUseCase`, `exportWorkflowUseCase`, `importWorkflowUseCase` |
| Infrastructure composition | `DexieWorkflowRepository`, `workflowDatabaseSchemas`, `DexieWorkflowPackageUnitOfWork` |
| Presentation components | `WorkflowLibrary`, `WorkflowLibraryProps`, `WorkflowEditor`, `WorkflowEditorProps`, `RewardDiceEditor`, `RewardDiceEditorProps` |
| Presentation editor API | `useWorkflowEditor`, `validateWorkflowDraft`, `PhaseDraft`, `RewardDiceDraft`, `RewardSideDraft`, `WorkflowDraft`, `WorkflowDraftErrors`, `WorkflowDraftValidation` |
| Presentation catalog API | `useWorkflowCatalog`, `WorkflowCatalogSource`, `WorkflowCatalogState` |

Infrastructure exports exist so `src/app` can compose concrete adapters. Their
presence in the root does not permit Presentation to instantiate them.

## Internal Layers

### Domain

[`domain/`](../../../src/features/workflow/domain/) contains the aggregate types,
constructor, eligibility calculation and random selection:

- `Workflow.ts` owns identity and aggregate/input shapes;
- `Phase.ts`, `Environment.ts`, `RewardDice.ts` and `DiceSide.ts` own value
  shapes;
- `createWorkflow.ts` validates, normalizes, copies and freezes the full
  aggregate;
- `isRewardDueAfterPhase.ts` counts completed matching Phase types;
- `rollReward.ts` selects one normalized Dice Side using injected randomness;
- `WorkflowErrors.ts` owns Domain validation failure.

### Application

[`application/`](../../../src/features/workflow/application/) owns use cases,
repository/unit-of-work ports and external package contracts. It depends on
Workflow Domain and uses Assets only through the Assets root API for package
operations.

### Infrastructure

[`infrastructure/`](../../../src/features/workflow/infrastructure/) owns the
version-1 Workflow record/schema, mapping, ordered Dexie repository and the
Workflow-plus-Assets transaction adapter.

### Presentation

[`presentation/`](../../../src/features/workflow/presentation/) owns React
components, the string-based editor draft and invalidation-driven catalog state.
It does not know Dexie or Chrome runtime APIs.

## Domain Invariants

### Workflow and Phase

- `WorkflowId` is a non-empty branded string.
- The trimmed Workflow name is non-empty.
- A Workflow contains at least one Phase and preserves Phase order.
- A Phase type is exactly `focus` or `break`.
- `durationSeconds` is a positive integer.
- Every Phase owns one Environment value, even when all fields are absent.
- Referenced background/audio Asset identifiers are non-empty strings branded
  as the shared `AssetId`.
- A supplied background color must not be whitespace-only; Domain does not
  validate that it is a browser-supported CSS color.
- The constructor freezes the aggregate, Phase array, values, Reward Dice and
  Dice Sides.

The editor adds a presentation constraint: duration is entered in minutes, must
be at least `0.5` and uses `0.5`-minute increments before conversion to integer
seconds. This is not the more general Domain duration rule.

### Reward Dice

- Reward Dice is absent or owned by exactly one Workflow.
- `triggerPhaseType` is `focus | break`; omitted legacy input defaults to
  `focus`.
- `frequency` is an integer of at least 1 matching completed Phase.
- `rerolls` is an integer from 0 through 3; omitted legacy input defaults to 0.
- At least two Dice Sides exist.
- Each side has a non-empty trimmed icon and title; optional descriptions are
  trimmed.
- Weights are supplied for every side or none.
- Every supplied weight and their total are finite and positive.
- Domain stores normalized `probability`, not the original arbitrary weight.
- If weights are omitted, every side receives equal probability.

`isRewardDueAfterPhase()` returns false for an invalid index, absent Reward Dice
or a non-matching Phase type. Otherwise it counts matching Phases from index 0
through the completed index and checks divisibility by `frequency`.

`rollReward()` accepts an injected random value only in `[0, 1)`, walks
cumulative normalized probability and returns a Dice Side. Randomness and
presentation animation are not part of the aggregate.

### Copy Boundaries

Creating, duplicating, importing and capturing a Session snapshot all rebuild
the aggregate through `createWorkflow()`. Reward Dice sides are copied by value;
reroll allowance is configuration, while the number used for a particular
Reward is Presentation state and resets with each new dialog.

## Use Cases

| Use case | Inputs | Behavior | Result/failure |
| --- | --- | --- | --- |
| `createWorkflowUseCase` | Repository, `CreateWorkflowInput` | Constructs Domain value, rejects existing ID, saves | New Workflow or `WorkflowApplicationError` |
| `updateWorkflowUseCase` | Repository, input | Reconstructs full aggregate, requires existing ID, saves without changing order | Updated Workflow or not-found error |
| `duplicateWorkflowUseCase` | Repository, source/new IDs | Requires source and unused destination, deep-copies through constructor, saves appended copy | Independent Workflow or Application error |
| `deleteWorkflowUseCase` | Repository, ID | Requires existence, deletes; repository compacts collection order | `void` or not-found error |
| `listWorkflowsUseCase` | Repository | Returns repository order | Readonly Workflow list |
| `reorderWorkflowsUseCase` | Repository, complete ordered IDs | Requires an exact permutation of current IDs, delegates atomic replacement | `void` or Application error |
| `exportWorkflowUseCase` | Workflow, Asset repository | Loads every referenced Asset/Blob, sorts identifiers and creates deterministic version-1 JSON | JSON or package validation error |
| `importWorkflowUseCase` | Repositories, unit of work, JSON, limits/policy/identity | Validates complete package before writes, generates collision-free IDs, rewrites Environment references, atomically writes Assets and Workflow | Imported Workflow or package validation/storage failure |

Composition wraps successful catalog mutations with
[`runWorkflowCatalogMutation`](../../../src/app/runWorkflowCatalogMutation.ts).
That invalidation is an `app` responsibility, not hidden behavior inside these
use cases.

## Persistence

`DexieWorkflowRepository` stores version-1 `WorkflowRecord` rows in the global
version-1 `workflows: 'id, order'` table definition.

- Reads treat rows as `unknown`, validate record metadata and reconstruct the
  Domain aggregate.
- New rows append after the highest order.
- Updates preserve the current order.
- Delete compacts remaining order values.
- Reordering verifies all records again inside one table transaction.
- Legacy stored trigger Phase type and rerolls remain optional and receive
  Domain defaults.

`DexieWorkflowPackageUnitOfWork` spans `workflows` and `assets`; it is used only
after package validation and identity rewriting.

See [Persistence and Compatibility](../PERSISTENCE.md) for schemas, records,
package differences and migrations.

## Presentation Consumers

### `WorkflowLibrary`

Renders empty/list states and delegates create, open, duplicate, delete,
reorder and optional start actions. It owns pending/error feedback and deletion
confirmation, but receives all operations as props. Options and side panel
compose different capabilities from the same component.

### `WorkflowEditor`

Owns draft validation feedback, pending state and transient accessible
`Workflow saved` confirmation. It delegates accepted input through `onSave` and
does not choose create versus update. It prevents removing the last Phase.

### `RewardDiceEditor`

Edits enablement, trigger Phase type, frequency, 0–3 rerolls and sides. It
disables side removal at two sides. UI weights remain strings until draft
validation converts them to numeric constructor input.

### Hooks

- `useWorkflowEditor` owns editable string/selection state and immutable draft
  updates. `validateWorkflowDraft` maps that state to `CreateWorkflowInput`.
- `useWorkflowCatalog` subscribes before loading, coalesces invalidations,
  preserves the last valid list on refresh failure and ignores work after
  unmount.

Current consumers:

- Options renders Library plus Editor and provides full CRUD/import/export;
- side panel renders the Library, opens selected Workflows in Options and can
  start a Session;
- idle focus view uses the catalog hook in its launcher and starts existing
  Workflows.

## Dependencies

- Domain depends on the minimal Shared Kernel `AssetId` only.
- Application depends on Workflow Domain and, for package operations, Assets
  root contracts.
- Infrastructure depends on Workflow ports/Domain, `LocusoraDatabase`, Dexie
  and Assets root contracts for the multi-table unit of work.
- Presentation depends on Workflow inward layers, React, shared UI and Assets
  public presentation/types where Asset selection is required.
- The feature never imports `src/app` or Chrome APIs.

See [Architecture Boundaries](../ARCHITECTURE_BOUNDARIES.md) for enforced import
direction.

## Failure Model

| Failure | Owner | Behavior |
| --- | --- | --- |
| Invalid aggregate, Phase, Environment, Reward Dice, side or random source | Domain | Throws `WorkflowValidationError` before a trusted Workflow is returned |
| Duplicate/missing ID or incomplete order | Application/repository | Throws `WorkflowApplicationError`; no accepted operation result |
| Invalid/oversized/corrupt package or missing referenced export Asset | Package Application | Throws `WorkflowPackageValidationError`; import performs no writes before validation succeeds |
| Corrupt stored row | Infrastructure mapper | Throws `WorkflowValidationError` at read boundary |
| IndexedDB/transaction failure | Infrastructure | Rejects; transaction rolls back its participating writes |
| Editor/library operation failure | Presentation | Keeps current draft/catalog where possible and renders accessible error feedback |
| Catalog event publication after a successful mutation fails | `app` composition | Persistent mutation remains committed; caller receives publication failure |

## Tests

| Area | Primary proof |
| --- | --- |
| Aggregate invariants and immutability | `domain/createWorkflow.test.ts` |
| Reward cadence | `domain/isRewardDueAfterPhase.test.ts` |
| Weighted selection/random boundary | `domain/rollReward.test.ts` |
| CRUD/order use cases | `application/workflowUseCases.test.ts` |
| Package compatibility, identity rewrite and validation | `application/workflowPackage.test.ts` |
| Ordered storage, legacy defaults and corrupt rows | `infrastructure/DexieWorkflowRepository.test.ts` |
| Atomic multi-table rollback | `infrastructure/DexieWorkflowPackageUnitOfWork.test.ts` |
| Library interactions | `presentation/WorkflowLibrary.test.tsx` |
| Editor/draft/minute/Reward behavior | `presentation/WorkflowEditor.test.tsx` and `RewardDiceEditor.test.tsx` |
| Catalog invalidation races/errors | `presentation/useWorkflowCatalog.test.tsx` |
| Assembled editing/start/import-export journey | `tests/e2e/workflowExecution.spec.ts`, `dataPortability.spec.ts` |

Run focused tests with:

```bash
pnpm vitest run src/features/workflow
```

## Change Impact Checklist

When changing Workflow behavior:

1. Confirm the product and Domain terminology in Concepts.
2. Update aggregate/input types and `createWorkflow()` invariants together.
3. Update every copy boundary: duplicate, package mapping/import, record mapping
   and Session snapshot.
4. Preserve or explicitly migrate legacy record/package behavior.
5. Check Asset reference kind/existence rules when Environment changes.
6. Update editor draft, validation, fields and successful feedback.
7. Update root exports only for intentionally supported consumers.
8. Check whether active Sessions must remain unchanged; normally they do because
   they own immutable snapshots.
9. Add the lowest-level Domain/Application/repository/component proof and E2E
   only when the assembled journey changes.
10. Update this reference, persistence docs and affected flow docs.

Related decision: [ADR-0003](../../adr/ADR-0003-workflow-aggregate-session-snapshot.md).
