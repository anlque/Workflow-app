# Assets Feature

## Global Asset Roles

An Asset may own one display `AssetRole`. Domain normalization applies NFKC,
collapses Unicode whitespace, trims it and limits it to 64 Unicode code points;
the global comparison key is locale-independent lowercase plus NFKC. User case
is preserved. Global Dexie version 4 adds the unique `&roleKey` index across
image and audio Assets. New records are version 2; reads remain compatible with
role-less version-1 records.

Role management first returns an authoritative typed preview, including the
current owner and affected Workflow count. Applying a create, display rename or
explicitly confirmed move rechecks that preview inside one Assets-plus-Workflows
transaction. Rename updates every matching Workflow Role reference; move keeps
the reference string stable and changes its owner. A target that already owns a
different Role is rejected rather than merging two aliases.
`resolveAssetRoleUseCase` distinguishes missing and wrong-kind Roles. Asset
retirement reuses the ST-005 injected Session port, then returns an authoritative
Workflow usage preview before any destructive write.

## Purpose

The Assets feature owns reusable local media and its lifecycle. In the MVP an
Asset is either an image or an audio file stored in the browser. Workflows keep
only direct Asset identifiers or Roles; they never own or embed Blob content at runtime.

Source root: [`src/features/assets/`](../../../src/features/assets/).

## Owns

- Asset metadata, identity validation and the `image | audio` kind;
- metadata-plus-Blob repository operations;
- local-file import validation through a caller-supplied policy;
- transactional retirement through injected active-Session, Workflow-reference
  and unit-of-work ports;
- version-2 Asset records and the global Dexie version-4 Role-index fragment;
- browser object URL creation/revocation;
- the reusable Asset Library, Picker and Preview components;
- the root public API in [`index.ts`](../../../src/features/assets/index.ts).

## Does Not Own

- which MIME types and size limits the product composition permits;
- Workflow Environment references or Workflow editing;
- reference counting implementation across stored Workflows;
- Workflow package envelopes, identifier rewriting or import transactions;
- ambient-audio playback in the focus surface;
- remote providers, bundled catalogs, video or animation.

The Options composition supplies the current import policy: PNG, JPEG and WebP
images up to 10 MiB; MP3, Ogg and WAV audio up to 50 MiB. These limits are app
policy, not hidden Asset Domain constants.

## Public API

Consumers import only from `@/features/assets`.

| Group                      | Exports                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain                     | `Asset`, `AssetId`, `AssetKind`, `AssetRole`, `CreateAssetInput`, `createAsset`, `createAssetId`, `createAssetRole`, `assetRoleKey`                     |
| Errors                     | `AssetValidationError`, `AssetRoleConflictError`, `AssetRoleMergeError`, `StaleAssetRoleChangeError`, `AssetRetirementValidationError`, `StaleAssetRetirementError`, `UnresolvedAssetRoleError`, `WrongKindAssetRoleError`, `ActiveSessionReferencedAssetError`, `AssetStorageError` |
| Application ports          | `AssetRepository`, `AssetRoleRepository`, `AssetRoleManagementRepository`, `AssetRoleWorkflowUsage`, `AssetRoleManagementUnitOfWork`, `ActiveSessionAssetReferences`, `AssetRetirementWorkflowReferences`, `AssetRetirementUnitOfWork` |
| Application behavior       | `inspectAssetRoleChangeUseCase`, `applyAssetRoleChangeUseCase`, `inspectAssetRetirementUseCase`, `retireAssetUseCase`, `importAssetUseCase`, `validateAssetImport`, `listAssetsUseCase`, `moveAssetRoleUseCase`, `resolveAssetRoleUseCase`, `AssetRetirementChoice`, `AssetRetirementPreview`, `AssetRetirementUsage` and Role/import policy types |
| Infrastructure composition | `DexieAssetRepository`, `assetDatabaseSchemas`, `BrowserAssetUrlService`                                                                                 |
| Presentation               | `AssetLibrary`, `AssetPicker`, `AssetPickerValue`, `AssetRoleDialog`, `AssetRetirementDialog`, `AssetRetirementDialogProps`, `AssetPreview` and their remaining prop types |

`AssetId` is re-exported from the minimal Shared Kernel. This lets Workflow and
Assets share one identity contract without either feature importing the other's
internals. See [ADR-0009](../../adr/ADR-0009-minimal-shared-kernel.md).

## Internal Layers

### Domain

[`domain/`](../../../src/features/assets/domain/) defines the immutable Asset
metadata value and the three failure types. It has no Blob, IndexedDB, file
picker or React dependency.

### Application

[`application/`](../../../src/features/assets/application/) defines the
repository and reference ports. Import validates file content and policy before
saving. Deletion asks the injected active Session port first, then the Workflow
reference counter, before touching the repository. This keeps Assets independent
of Session and Workflow Infrastructure.

### Infrastructure

[`infrastructure/`](../../../src/features/assets/infrastructure/) maps and
validates version-2 and compatible role-less version-1 Asset records, implements
the Dexie repository and wraps the browser object URL API.

### Presentation

[`presentation/`](../../../src/features/assets/presentation/) contains prop-
driven React components. They receive persistence and URL operations from the
composition root; they do not instantiate repositories.

## Domain Invariants

- `AssetId` is a non-empty branded string.
- The trimmed name and MIME type are non-empty.
- Kind is exactly `image` or `audio`.
- `byteSize` is a positive safe integer.
- `createdAt` is finite and non-negative.
- The returned metadata object is frozen.
- Import content is non-empty, within the injected kind-specific size limit and
  has a MIME type allowed for that kind.
- Stored Blob size and MIME type must exactly match the metadata on both reads
  and writes.
- Raw Asset deletion is not a supported UI operation. Retirement must resolve
  every stored Workflow reference in the same transaction.
- An Asset referenced anywhere in an active immutable Session snapshot cannot be
  retired, even when its saved Workflow no longer references it.
- A replacement has the source kind. Optional references may be removed;
  required references must receive a replacement.

The feature trusts declared browser MIME data only after exact policy matching;
it does not decode media or inspect magic bytes.

## Use Cases

| Use case              | Inputs                                             | Behavior                                                         | Result/failure                                       |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| `validateAssetImport` | Policy and import input                            | Validates policy, Blob content/MIME/size and constructs metadata | Trusted `Asset` or `AssetValidationError`            |
| `importAssetUseCase`  | Repository, policy, identifier/name/kind/Blob/time | Validates completely, then saves metadata and Blob               | Imported Asset; no write on validation failure       |
| `listAssetsUseCase`   | Repository                                         | Delegates the ordered local catalog read                         | Readonly Asset list                                  |
| `inspectAssetRetirementUseCase` | Repository, active Session and Workflow ports, Asset ID | Blocks active use and returns affected Workflows/counts | Immutable preview or typed error |
| `retireAssetUseCase` | Repository, ports, unit of work, policy, preview and choice | Rechecks the preview; replaces with existing/uploaded same-kind Asset or removes optional references; transfers Role and deletes source | `void`; every durable write commits or rolls back together |

The Options composition generates identifiers and timestamps. It composes
`ActiveSessionAssetReferences` from the public Session query and
`DexieSessionRepository`, and adapts Workflow-owned traversal/patch functions to
the narrow Assets retirement port.

## Persistence

`DexieAssetRepository` writes version-2 records in global Dexie version 4:
`assets: 'id, createdAt, &roleKey'`. Metadata and Blob content are one record;
the optional normalized Role key is globally unique across Asset kinds. Reads
accept version 2 and role-less version 1 as `unknown`, validate the envelope,
rebuild the Domain value and compare Blob
metadata. Listing sorts mapped Assets by `createdAt`.

A browser `QuotaExceededError` during save becomes `AssetStorageError`; other
storage failures propagate. Object URLs are transient and never persisted.

Workflow package export loads every referenced Blob and embeds it as Base64.
Import validates the complete package, creates new identifiers and writes its
Assets and Workflow in one Dexie transaction owned by the Workflow feature.
See [Persistence and Compatibility](../PERSISTENCE.md) and
[ADR-0007](../../adr/ADR-0007-versioned-import-export.md).

## Presentation Consumers

### `AssetLibrary`

Options uses the library for local import, preview, Role management and a
two-step retirement dialog. The first step lists affected Workflows and direct/
Role usage; the second chooses an existing same-kind Asset, a new upload or
optional-reference removal. The injected Application operation remains the
authoritative kind/size/MIME and transaction boundary. Rejections remain inline
and retryable without nesting another modal.
Each card shows its current Role or `No Role`. The accessible Role dialog
restores the invoking control on close, previews global impact before mutation
and labels occupied-Role confirmation `Move role`.

### `AssetPicker`

Workflow editing groups kind-compatible options into `Choose Asset directly`
and `Follow Role`. It emits the complete discriminated reference union. An empty
selection maps to `undefined`; a currently selected unresolved or wrong-kind
Role remains visible as unavailable rather than being silently replaced.

### `AssetPreview`

The preview loads the Blob lazily, creates one object URL and revokes the owned
URL on cleanup. It renders an image or controlled audio element and reports
missing content without inventing a fallback Asset.

Focus playback also loads referenced Blobs through `AssetRepository` and owns
its own transient object URL/audio lifecycle in `src/app/focus`.

`useAmbientAudio` keeps one hidden media element and one active object URL while
the current Phase is playing. The focus document listens for supported
`mediaDevices.devicechange` events and coalesces a burst into one playback-state
check. Audio that Chrome has already rerouted and kept playing is left untouched.
If the element is paused after the device change, Focus preserves its source and
browser-maintained position and offers manual Resume. Resume calls `play()` on
that element without pausing, loading or seeking, then fades to the latest
volume. Recoverable aborted/network media failures offer the same action; decode and
unsupported-source failures are terminal for that source.

Initial autoplay rejection exposes **Enable audio**. A device-induced pause or
rejected Resume exposes the separate, non-blocking **Resume audio** action.
Pause, source replacement and focus-document teardown cancel listeners, timers
and invalidate pending playback results.
Ambient playback remains transient Presentation behavior: every failure leaves
the background-authoritative Session timer and transitions unchanged. Cue/audio
channel policy remains deferred to AU-001.

## Dependencies

- Domain depends only on Shared Kernel `AssetId` and its own errors.
- Application depends inward on Asset Domain and on injected ports.
- Infrastructure depends on Asset contracts, `LocusoraDatabase`, Dexie and
  browser URL APIs.
- Presentation depends on Asset Domain, React and Shared UI.
- Workflow may consume the Assets root API for public package operations; no
  feature imports Assets internals.
- Assets never imports Session. Options composes the public Session query into
  the narrow active-reference port alongside Workflow counting and UI operations.
- Role management and Asset retirement reuse this port/query boundary. RW-005
  extends Session's one snapshot traversal for Bonus environments. ADR-0011
  supersedes ADR-0006.

## Failure Model

| Failure                                    | Owner              | Behavior                                                     |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------ |
| Invalid metadata or import policy/content  | Domain/Application | Throws `AssetValidationError` before persistence             |
| Stale retirement preview                   | Application        | Rejects before mutation; user reviews current usage again    |
| Required-reference removal                 | Application        | Requires a same-kind replacement before any write            |
| Active Session Asset retirement            | Application        | Throws `ActiveSessionReferencedAssetError` before Workflow lookup or mutation |
| Corrupt record or mismatched Blob metadata | Infrastructure     | Throws `AssetValidationError` at the read/write boundary     |
| Browser quota exhausted                    | Infrastructure     | Throws normalized `AssetStorageError`                        |
| Missing preview Blob                       | Presentation       | Shows `Preview unavailable`                                  |
| Import/retirement dependency failure       | Presentation       | Preserves the consistent catalog and displays accessible retry feedback |

## Tests

| Area                                              | Primary proof                                               |
| ------------------------------------------------- | ----------------------------------------------------------- |
| Metadata invariants and immutability              | `domain/Asset.test.ts`                                      |
| Import policy and legacy guard behavior          | `application/assetUseCases.test.ts`                       |
| Retirement validation and orchestration          | `application/assetRetirementUseCases.test.ts`             |
| Cross-table rollback at every write step          | `src/app/options/DexieAssetRetirementUnitOfWork.test.ts`   |
| Blob mapping, corrupt rows, quota and object URLs | `infrastructure/DexieAssetRepository.test.ts`               |
| Library and two-step retirement feedback          | `presentation/AssetLibrary.test.tsx`, `AssetRetirementDialog.test.tsx` |
| Kind filtering and empty selection                | `presentation/AssetPicker.test.tsx`                         |
| Blob loading and URL cleanup                      | `presentation/AssetPreview.test.tsx`                        |
| Workflow package participation                    | `src/features/workflow/application/workflowPackage.test.ts` |

Run focused tests with:

```bash
pnpm vitest run src/features/assets
```

## Change Impact Checklist

1. Confirm whether the change belongs to local MVP Assets or a future provider.
2. Keep `AssetId` in the Shared Kernel; keep Asset behavior in this feature.
3. Update Domain validation and every record/package mapper together.
4. Keep size/MIME limits injected unless the rule becomes a Domain invariant.
5. Preserve no-write-before-validation and transactional retirement.
6. Preserve active Session guard priority over Workflow reference counting.
7. Check Workflow Environment kind/reference validation and package mapping.
8. Verify every object URL has one explicit revocation owner.
9. Update unit, repository and component tests; add E2E only for an assembled
   user journey change.
