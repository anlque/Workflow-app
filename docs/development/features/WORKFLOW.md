# Workflow Feature

## Asset reference modes

Environment background and audio values are a discriminated `direct` Asset ID
or `role` union. Background Role resolution requires an image; audio resolution
requires audio. `resolveWorkflowAssetReferences` rebuilds a direct-only Workflow
before Session creation. The editor draft stores one discriminated reference
per Environment slot, and its picker explicitly offers direct Asset and Role
modes. Unrelated Phase edits preserve the selected reference variant.

Workflow record version 7 writes an explicit configuration mode. Detailed
records contain optional normalized Phase names and the reference
union, canonical Reward schedule, Side availability and optional Side Bonus
Reward Phase. Its mapper reads version-1
`backgroundAssetId`/`audioAssetId` fields as direct references. Table indexes
remain `id, order`. Quick records contain only validated cycle configuration,
never generated Phases. Package export writes version 7; import supports versions
1–7 and maps versions 1–6 to Detailed.

## Purpose

The Workflow feature owns reusable focus configuration. A Workflow is the
aggregate root for its ordered Phases, each Phase's Environment and its optional
Reward Dice. The feature also owns the repository-backed Workflow Library
collection, CRUD/reordering use cases, package import/export and reusable
Workflow presentation.

Source root: [`src/features/workflow/`](../../../src/features/workflow/).

## Owns

- `Workflow` identity, name, Quick/Detailed configuration mode and ordered
  non-empty executable Phase projection;
- `Phase`, `Environment`, Reward Dice and Dice Side value semantics;
- Reward eligibility and weighted side selection;
- Workflow repository port and CRUD/list/order use cases;
- Quick-to-Detailed conversion contract and atomic replacement/copy/order unit
  of work;
- Workflow package contract, mapping, import/export and atomic unit-of-work port;
- Workflow record mapping, table ordering and Dexie adapters;
- Workflow Library, editor, Reward Dice editor and catalog/editor hooks;
- the root behavior/data API in
  [`index.ts`](../../../src/features/workflow/index.ts) and lazy Studio
  presentation API in
  [`studio.ts`](../../../src/features/workflow/studio.ts).

## Does Not Own

- active Session execution, timing, pause or completion;
- Asset identity semantics beyond the shared `AssetId` reference contract;
- Asset Blob lifecycle, MIME/size policy or deletion rules;
- Chrome runtime messaging or catalog-event transport;
- Options/focus/side-panel composition;
- Reward Dice Templates, marketplace data or remote providers.

The Workflow Library is the ordered repository-backed collection of local
Workflows. It is not a separately persisted Entity or aggregate.

Starter-content version 2 creates Quick Focus, Balanced Flow and Reward Journey
through the same `CreateWorkflowInput` constructor and repository used by user
Workflows. Their Environments follow version-1 starter Asset Roles. The records
have no protected/template state: edit, reorder, duplicate, export and delete
behavior is identical to every other local Workflow, and completed seeding never
restores a changed or deleted example.

## Public API

External consumers import behavior/data from `@/features/workflow`. The
allowlisted Workflow Studio and Side Panel presentation consumers use
`@/features/workflow/studio`. The public APIs currently export:

| Group | Exports |
| --- | --- |
| Domain value types | `BonusRewardPhase`, `DiceSide`, Asset/Environment/Phase/Reward types, `QuickWorkflowConfiguration`, `QuickWorkflow`, `DetailedWorkflow`, `CreateWorkflowInput`, `Workflow`, `WorkflowId` |
| Domain behavior and errors | `createWorkflowId`, `createWorkflow`, `rollReward`, `eligibleDiceSides`, `rewardOpportunityPhaseIndexes`, `isRewardDueAfterPhase`, `WorkflowValidationError` |
| Application contracts and errors | `WorkflowRepository`, `WorkflowConversionUnitOfWork`, conversion inputs/results, `AssetReferenceResolver`, source-aware Environment traversal, `WorkflowRoleUsageSummary`, `WorkflowApplicationError`, `WorkflowPackageV1`–`WorkflowPackageV7`, `WorkflowPackageUnitOfWork`, `WorkflowPackageValidationError`, `WorkflowImportIdentity`, `WorkflowImportOptions` |
| Application use cases | `createWorkflowUseCase`, `deleteWorkflowUseCase`, `duplicateWorkflowUseCase`, `listWorkflowsUseCase`, `reorderWorkflowsUseCase`, `updateWorkflowUseCase`, `convertQuickWorkflowUseCase`, `resolveWorkflowAssetReferences`, Role-summary/rename and Asset-retirement summary/patch operations, `exportWorkflowUseCase`, `importWorkflowUseCase` |
| Infrastructure composition | `DexieWorkflowRepository`, `workflowDatabaseSchemas`, `DexieWorkflowPackageUnitOfWork`, `DexieWorkflowConversionUnitOfWork` |
| Presentation components (`/studio`) | `WorkflowLibrary`, `WorkflowLibraryProps`, `WorkflowEditor`, `WorkflowEditorProps`, `QuickWorkflowEditor`, `QuickWorkflowEditorProps`, `RewardDiceEditor`, `RewardDiceEditorProps` |
| Presentation editor API (`/studio`) | `useWorkflowEditor`, `validateWorkflowDraft`, `useQuickWorkflowEditor`, `validateQuickWorkflowDraft`, Detailed and Quick draft types |
| Presentation catalog API | `useWorkflowCatalog`, `WorkflowCatalogSource`, `WorkflowCatalogState` |

Infrastructure exports exist so `src/app` can compose concrete adapters. Their
presence in the root does not permit Presentation to instantiate them.

## Internal Layers

### Domain

[`domain/`](../../../src/features/workflow/domain/) contains the aggregate types,
constructor, eligibility calculation and random selection:

- `Workflow.ts` owns identity and aggregate/input shapes;
- `Phase.ts`, `Environment.ts`, `BonusRewardPhase.ts`, `RewardDice.ts` and `DiceSide.ts` own value
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
versioned Workflow record mapping, global version-1 table schema, ordered Dexie repository and the
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
- Detailed is the legacy/default authored-Phase mode. Quick stores 1–20 cycles,
  Focus/Short Break and optional Long Break source Environments plus optional
  simplified Reward cadence. It deterministically derives `Focus -> Break`
  cycles, including the final Break, and fixed names `Focus`, `Short break` and
  `Long break`.
- Ordinary update cannot change mode. `convertQuickWorkflowUseCase` is the
  only Quick-to-Detailed boundary: it preserves the source ID and materialized
  executable values while atomically replacing the source, optionally adding a
  retained Quick copy and writing the complete library order.
- A Phase type is exactly `focus` or `break`.
- A supplied Phase name is trimmed; blank names normalize to absence. Absent
  names display as `Phase N` without persisting that fallback.
- Detailed Phase `durationSeconds` is a positive integer. Quick Focus, Short
  Break and Long Break durations are at least 30 seconds and use 30-second
  increments.
- Every Phase owns one Environment value, even when all fields are absent.
- Direct background/audio identifiers are non-empty shared `AssetId` values;
  Role references contain a validated `AssetRole`.
- A supplied background color must not be whitespace-only; Domain does not
  validate that it is a browser-supported CSS color.
- The constructor freezes the aggregate, Phase array, values, Reward Dice and
  Dice Sides.

The editor adds a presentation constraint: duration is entered in minutes, must
be at least `0.5` and uses `0.5`-minute increments before conversion to integer
seconds. This is not the more general Domain duration rule.

### Reward Dice

- Reward Dice is absent or owned by exactly one Workflow.
- `schedule` is exactly one of `frequency | custom`.
- A frequency schedule has `triggerPhaseType: focus | break` and a positive
  integer `frequency`; omitted legacy trigger type defaults to `focus`.
- A custom schedule stores unique, zero-based Phase indexes in ascending order;
  every index must be an integer within the Workflow.
- `rerolls` is an integer from 0 through 3; omitted legacy input defaults to 0.
- At least two Dice Sides exist.
- Every Side has `availability: any | early | late`; legacy inputs default to
  `any`.
- Actual opportunity indexes come from the canonical schedule. Early and late
  each cover one half; an odd middle opportunity belongs to both, while `any`
  always remains eligible. Every opportunity must have an eligible Side.
- Each side has a non-empty trimmed icon and title; optional descriptions are
  trimmed.
- Weights are supplied for every side or none.
- Every supplied weight and their total are finite and positive.
- Domain stores normalized `probability`, not the original arbitrary weight.
- If weights are omitted, every side receives equal probability.
- Each Side may own at most one Bonus Reward Phase. Its trimmed name is
  non-empty, duration is a positive integer in seconds and Environment follows
  the same Asset/reference/color rules as a normal Phase. The nested value is
  deeply immutable. Session execution uses it only after an authoritative
  Reward result is acknowledged; it remains configuration in the Workflow.

`isRewardDueAfterPhase()` returns false for an invalid index or absent Reward
Dice. Custom schedules use exact Phase membership; frequency schedules preserve
the matching-type ordinal rule.

`rollReward()` accepts an injected random value only in `[0, 1)`, walks
cumulative probability after filtering and renormalizing eligible Side weights,
then returns a Dice Side. Randomness and
presentation animation are not part of the aggregate.

### Copy Boundaries

Creating, duplicating, importing and capturing a Session snapshot all rebuild
the aggregate through `createWorkflow()`. Reward Dice sides and optional Bonus
Phases are copied by value. Session Domain owns per-opportunity reroll usage.

## Use Cases

| Use case | Inputs | Behavior | Result/failure |
| --- | --- | --- | --- |
| `createWorkflowUseCase` | Repository, `CreateWorkflowInput` | Constructs Domain value, rejects existing ID, saves | New Workflow or `WorkflowApplicationError` |
| `updateWorkflowUseCase` | Repository, input | Reconstructs full aggregate, requires existing ID, saves without changing order | Updated Workflow or not-found error |
| `duplicateWorkflowUseCase` | Repository, source/new IDs | Requires source and unused destination, deep-copies through constructor, saves appended copy | Independent Workflow or Application error |
| `deleteWorkflowUseCase` | Repository, ID | Requires existence, deletes; repository compacts collection order | `void` or not-found error |
| `listWorkflowsUseCase` | Repository | Returns repository order | Readonly Workflow list |
| `reorderWorkflowsUseCase` | Repository, complete ordered IDs | Requires an exact permutation of current IDs, delegates atomic replacement | `void` or Application error |
| `convertQuickWorkflowUseCase` | Repository, conversion unit of work, validated current Quick input, optional copy ID | Materializes an equivalent Detailed replacement; optional copy uses `Name (Quick copy)`, then incrementing numeric suffixes; computes Quick-first/Detailed-second full order | Converted value/copy/order or Application/storage error; no partial writes |
| `exportWorkflowUseCase` | Workflow, Asset repository | Resolves referenced source Environments/Blobs and creates deterministic version-7 JSON | JSON or package validation error |
| `importWorkflowUseCase` | Repositories, unit of work, JSON, limits/policy/identity | Validates complete package before writes, generates collision-free IDs, rewrites Environment references, atomically writes Assets and Workflow | Imported Workflow or package validation/storage failure |

Composition wraps successful catalog mutations with
[`runWorkflowCatalogMutation`](../../../src/app/runWorkflowCatalogMutation.ts).
That invalidation is an `app` responsibility, not hidden behavior inside these
use cases.

## Persistence

`DexieWorkflowRepository` writes version-7 `WorkflowRecord` rows in the global
version-1 `workflows: 'id, order'` table definition and reads versions 1–7.

- Reads treat rows as `unknown`, validate record metadata and reconstruct the
  Domain aggregate.
- Version 1 accepts only legacy ID Environment fields; versions 2–7 accept only
  exact direct-or-Role reference fields. Versions 1–2 read legacy frequency
  fields; versions 3–7 read the canonical schedule union. Versions 1–3 default
  missing Side availability to `any`; versions 4–7 require it. Versions 5–7
  accept the optional exact Bonus Reward Phase shape; version 6 additionally
  accepts an optional Phase name. Version 7 requires either a Detailed payload
  or a Quick source configuration and never accepts both.
- New rows append after the highest order.
- Updates preserve the current order.
- Delete compacts remaining order values.
- Reordering verifies all records again inside one table transaction.
- Legacy stored trigger Phase type and rerolls remain optional and receive
  Domain defaults.

`DexieWorkflowPackageUnitOfWork` spans `workflows` and `assets`; it is used only
after package validation and identity rewriting.

`DexieWorkflowConversionUnitOfWork` spans only `workflows`. Replacement,
optional copy and every resulting `order` value commit in one transaction.

See [Persistence and Compatibility](../PERSISTENCE.md) for schemas, records,
package differences and migrations.

## Presentation Consumers

### `WorkflowLibrary`

Renders one catalog as non-empty Quick then Detailed groups while preserving
repository order inside each group. Mode badges identify every card; creation
explicitly chooses Quick or Detailed setup. It delegates open, duplicate,
delete, within-group reorder and optional start actions, owns pending/error
feedback and deletion confirmation, and receives all operations as props.
Options and side panel compose different capabilities from the same component.

### `QuickWorkflowEditor`

Authors only canonical Quick configuration: name, cycles, three Environment
presets, optional Long Break cadence and optional cycle-based Reward Dice. It
reuses Asset selection and inline upload boundaries. Its right-hand Reward
sides drawer exposes only icon, title and optional weight; generated Phases are
never editable or persisted as a second source of truth. Dirty navigation is
guarded by Workflow Studio until save or explicit discard.
For a persisted Quick Workflow it also owns the irreversible confirmation UI.
Clean drafts show `Convert`; dirty drafts show `Save and convert` and pass the
validated current draft to the Application boundary. After a durable commit,
publication/reload recovery offers only `Retry sync`, so it cannot repeat the
conversion.

### `WorkflowEditor`

Owns draft validation feedback, pending state and transient accessible
`Workflow saved` confirmation. It delegates accepted input through `onSave` and
does not choose create versus update. It prevents removing the last Phase.
The approved Detailed composition keeps Phases and Reward Dice in accessible
local tabs without unmounting either draft subtree. The Phase tab presents an
ordered, keyboard-selectable sequence before a large preview of the selected
Phase Environment. Unsaved color and direct/Role image changes update that
preview immediately; ambient audio is described only and is never played.
Preview blob loading and object-URL ownership use injected Asset boundaries, so
the editor does not read persistence or browser APIs directly.
Phase disclosure state is local to the mounted editor and never persisted;
save validation expands any collapsed Phase containing an invalid field.
Phase order is also local draft state until **Save workflow**. Pointer drag and
the visible Move up/down keyboard controls share
`movePhaseTo(phaseKey, targetIndex)`, where the target is the final index after
source removal. Drag previews only a drop position and commits once on pointer
release; Escape, pointer cancellation, lost capture and unmount discard it and
clean pointer/autoscroll resources. Autoscroll targets the nearest scrollable
Studio container or the standalone document viewport and recalculates the drop
position after every scroll frame. Stable Phase keys carry disclosure state,
unsaved values, Asset references and custom Reward markers through every move.
Normal and Bonus Environment pickers may request a kind-specific Asset import
through Workflow Studio. The mounted editor retains every draft field while the
Studio adds the committed Asset to its catalog, selects a direct reference and
then synchronizes the authoritative catalog. Role assignment remains a separate
explicit Asset Library operation.

### `RewardDiceEditor`

Edits enablement, frequency or custom marker schedule, 0–3 rerolls, sides and
each Side's optional Bonus Reward Phase configuration.
Custom markers bind to stable Phase draft keys: reorder moves them, delete
removes them and duplicate copies them. Save converts keys to current indexes.
It disables side removal at two sides. UI weights remain strings until draft
validation converts them to numeric constructor input.

### Hooks

- `useWorkflowEditor` owns editable string/selection state and immutable draft
  updates. `validateWorkflowDraft` maps that state to `CreateWorkflowInput`.
- `useQuickWorkflowEditor` owns the string-based Quick draft and maps a valid
  draft directly to `CreateQuickWorkflowInput` without materialized Phases.
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
