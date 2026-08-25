# Assets Feature

## Purpose

The Assets feature owns reusable local media and its lifecycle. In the MVP an
Asset is either an image or an audio file stored in the browser. Workflows keep
only stable Asset identifiers; they never own or embed Blob content at runtime.

Source root: [`src/features/assets/`](../../../src/features/assets/).

## Owns

- Asset metadata, identity validation and the `image | audio` kind;
- metadata-plus-Blob repository operations;
- local-file import validation through a caller-supplied policy;
- reference-aware deletion through an injected Workflow reference counter;
- the IndexedDB Asset record and version-3 schema fragment;
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
| Domain                     | `Asset`, `AssetId`, `AssetKind`, `CreateAssetInput`, `createAsset`, `createAssetId`                                                                      |
| Errors                     | `AssetValidationError`, `ReferencedAssetError`, `AssetStorageError`                                                                                      |
| Application ports          | `AssetRepository`, `WorkflowAssetReferences`                                                                                                             |
| Application behavior       | `importAssetUseCase`, `validateAssetImport`, `deleteAssetUseCase`, `listAssetsUseCase`, `AssetImportPolicy`, `AssetKindImportPolicy`, `ImportAssetInput` |
| Infrastructure composition | `DexieAssetRepository`, `assetDatabaseSchemas`, `BrowserAssetUrlService`                                                                                 |
| Presentation               | `AssetLibrary`, `AssetPicker`, `AssetPreview` and their prop types                                                                                       |

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
repository and reference-count ports. Import validates file content and policy
before saving. Deletion asks the injected reference service before touching the
repository. This keeps Assets independent of Workflow Infrastructure.

### Infrastructure

[`infrastructure/`](../../../src/features/assets/infrastructure/) maps and
validates version-1 Asset records, implements the Dexie repository and wraps the
browser object URL API.

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
- An Asset referenced by one or more Workflows cannot be deleted.

The feature trusts declared browser MIME data only after exact policy matching;
it does not decode media or inspect magic bytes.

## Use Cases

| Use case              | Inputs                                             | Behavior                                                         | Result/failure                                       |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| `validateAssetImport` | Policy and import input                            | Validates policy, Blob content/MIME/size and constructs metadata | Trusted `Asset` or `AssetValidationError`            |
| `importAssetUseCase`  | Repository, policy, identifier/name/kind/Blob/time | Validates completely, then saves metadata and Blob               | Imported Asset; no write on validation failure       |
| `listAssetsUseCase`   | Repository                                         | Delegates the ordered local catalog read                         | Readonly Asset list                                  |
| `deleteAssetUseCase`  | Repository, reference counter, Asset ID            | Validates the count, rejects references, otherwise deletes       | `void`, `ReferencedAssetError` or dependency failure |

The Options composition generates identifiers and timestamps. It implements
`WorkflowAssetReferences` by counting Workflows with at least one matching
Environment reference, then refreshes its local snapshot after mutations.

## Persistence

`DexieAssetRepository` stores version-1 records in global Dexie version 3:
`assets: 'id, createdAt'`. Metadata and Blob content are one record. Reads accept
`unknown`, validate the envelope, rebuild the Domain value and compare Blob
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

Options uses the library for local import, preview and guarded deletion. It
infers `image` or `audio` from the selected file's MIME prefix, renders pending
and accessible error feedback, and confirms deletion. The injected Application
operation remains the authoritative kind/size/MIME boundary.

### `AssetPicker`

Workflow editing uses the picker to show only Assets of the requested kind. An
empty selection maps to `undefined`, so Environments remain identifier-based.

### `AssetPreview`

The preview loads the Blob lazily, creates one object URL and revokes the owned
URL on cleanup. It renders an image or controlled audio element and reports
missing content without inventing a fallback Asset.

Focus playback also loads referenced Blobs through `AssetRepository` and owns
its own transient object URL/audio lifecycle in `src/app/focus`.

## Dependencies

- Domain depends only on Shared Kernel `AssetId` and its own errors.
- Application depends inward on Asset Domain and on injected ports.
- Infrastructure depends on Asset contracts, `FlowariumDatabase`, Dexie and
  browser URL APIs.
- Presentation depends on Asset Domain, React and Shared UI.
- Workflow may consume the Assets root API for public package operations; no
  feature imports Assets internals.
- Options composes policy, repositories, reference counting and UI operations.

## Failure Model

| Failure                                    | Owner              | Behavior                                                     |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------ |
| Invalid metadata or import policy/content  | Domain/Application | Throws `AssetValidationError` before persistence             |
| Invalid Workflow reference count           | Application        | Throws; deletion is not attempted                            |
| Referenced Asset deletion                  | Application        | Throws `ReferencedAssetError` with the Workflow count        |
| Corrupt record or mismatched Blob metadata | Infrastructure     | Throws `AssetValidationError` at the read/write boundary     |
| Browser quota exhausted                    | Infrastructure     | Throws normalized `AssetStorageError`                        |
| Missing preview Blob                       | Presentation       | Shows `Preview unavailable`                                  |
| Import/delete dependency failure           | Presentation       | Preserves the catalog and displays accessible error feedback |

## Tests

| Area                                              | Primary proof                                               |
| ------------------------------------------------- | ----------------------------------------------------------- |
| Metadata invariants and immutability              | `domain/Asset.test.ts`                                      |
| Import policy and guarded deletion                | `application/assetUseCases.test.ts`                         |
| Blob mapping, corrupt rows, quota and object URLs | `infrastructure/DexieAssetRepository.test.ts`               |
| Library import/delete feedback                    | `presentation/AssetLibrary.test.tsx`                        |
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
5. Preserve no-write-before-validation and reference-aware deletion.
6. Check Workflow Environment kind/reference validation and package mapping.
7. Verify every object URL has one explicit revocation owner.
8. Update unit, repository and component tests; add E2E only for an assembled
   user journey change.
