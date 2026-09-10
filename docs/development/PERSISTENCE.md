# Persistence and Compatibility

## AS-001 compatibility update

Global Dexie version 4 defines `assets: 'id, createdAt, &roleKey'`. The optional
normalized key is globally unique; role-less rows are not indexed. Asset,
Workflow and Session writers emit record version 2 while readers accept their
compatible version-1 rows. Workflow and Session indexes are unchanged.

Workflow package export emits version 2 with direct-or-Role references and
optional Asset Roles; import accepts versions 1–2. Local collisions become
`<role> (imported)`, `<role> (imported 2)`, and so on. ID/Role reservation,
reference remapping and every Asset/Workflow write occur in one transaction.

Locusora is local-first. Domain values remain independent of storage, while
feature Infrastructure owns records, validation, mapping and repository
adapters. This page documents the current durable formats and the procedure for
changing them safely.

## Storage Ownership

| Data | Store | Key/indexes | Owning adapter | Notes |
| --- | --- | --- | --- | --- |
| Workflows | IndexedDB database `locusora`, table `workflows` | Primary `id`; index `order` | `DexieWorkflowRepository` | `order` is persistence metadata for the Workflow Library collection, not part of the Domain aggregate |
| Sessions | IndexedDB database `locusora`, table `sessions` | Primary `id`; indexes `active`, `updatedAt` | `DexieSessionRepository` | Running, Transitioning and Paused use `active = 1`; Completed and Stopped use `active = 0` |
| Asset metadata and Blob content | IndexedDB database `locusora`, table `assets` | Primary `id`; indexes `createdAt`, unique optional `roleKey` | `DexieAssetRepository` | Metadata and Blob are one record; Workflow Environments store direct IDs or Roles |
| Settings | `chrome.storage.local`, key `settings` | Chrome Storage key only | `ChromeSettingsRepository` | Theme, reduced motion and optional last-selected Workflow; missing value resolves to defaults |
| React/Zustand state, countdown text, object URLs and audio state | Not persistent | None | Owning Presentation or `app` module | Reconstructed from durable facts and browser state |

[ADR-0005](../adr/ADR-0005-local-first-persistence.md) owns this technology and
data split. No network fallback or synchronization exists in the MVP.

## Pre-release Identity Reset

The pre-release identity rename creates the fresh `locusora` IndexedDB
database. No runtime migration or cleanup is performed. Export local data that
must be retained before loading the renamed build; otherwise clear old extension
data manually from Chrome's extension details or DevTools **Application**
storage.

## Composed IndexedDB Schema

[`LocusoraDatabase`](../../src/platform/storage/LocusoraDatabase.ts) opens one
Dexie database named `locusora`. Feature Infrastructure exports schema
fragments; each production runtime composition supplies the same complete list:

```ts
[
  ...workflowDatabaseSchemas,
  ...sessionDatabaseSchemas,
  ...assetDatabaseSchemas,
]
```

`LocusoraDatabase` sorts fragments by version and accumulates their store
definitions before calling `this.version(version).stores(...)`. The effective
history is:

| Global Dexie version | Owning fragment | New definition | Effective stores after composition |
| --- | --- | --- | --- |
| 1 | Workflow | `workflows: 'id, order'` | `workflows` |
| 2 | Session | `sessions: 'id, active, updatedAt'` | `workflows`, `sessions` |
| 3 | Assets | `assets: 'id, createdAt'` | `workflows`, `sessions`, `assets` |
| 4 | Assets | `assets: 'id, createdAt, &roleKey'` | `workflows`, `sessions`, `assets` |

Versions belong to the complete database, not to a feature. The next schema
change uses global version 5 regardless of which feature owns it. Store
definitions must remain cumulative.

The background, focus, Options and side-panel production composition roots all
register versions 1–4 in this order. Focus and side panel include tables they do
not currently query so that opening any context creates the same database
schema. Focused repository tests may compose only the minimum fragments required
by that test database.

## Dexie Version vs Record `schemaVersion`

These version numbers solve different compatibility problems:

| Version | Scope | Current value | Changes when |
| --- | --- | --- | --- |
| Dexie database version | Whole `locusora` database structure and upgrade order | 1–4 history; current 4 | A table/index changes or existing stored data needs a database migration |
| `WorkflowRecord.schemaVersion` | One Workflow record serialization shape | Current writes 2; reads 1–2 | The Workflow record reader/writer needs a new incompatible serialization |
| `SessionRecord.schemaVersion` | One Session record envelope | Current writes 2; reads 1–2 | The Session record reader/writer needs a new incompatible serialization |
| `AssetRecord.schemaVersion` | One Asset record shape | Current writes 2; reads role-less 1 and 2 | The Asset record reader/writer needs a new incompatible serialization |
| Workflow package `version` | Public `locusora/workflow` import/export envelope | Current export 2; import 1–2 | The external Workflow package contract changes |
| Settings package `version` | Public `locusora/settings` import/export envelope | 1 | The external Settings package contract changes |

A database version must not be copied into a record, and a record
`schemaVersion` must not be used to order Dexie migrations. Public package
versions are independent of both.

## Workflow Records

Sources:

- [`WorkflowRecord.ts`](../../src/features/workflow/infrastructure/WorkflowRecord.ts)
  owns the record and version-1 schema fragment.
- [`mapWorkflowRecord.ts`](../../src/features/workflow/infrastructure/mapWorkflowRecord.ts)
  validates/maps `unknown` records and serializes Domain Workflows.
- [`DexieWorkflowRepository.ts`](../../src/features/workflow/infrastructure/DexieWorkflowRepository.ts)
  owns table queries, ordering and writes.

The record stores:

- `id`, current `schemaVersion: 2`, `order` and `name`;
- ordered Phase values with `type`, `durationSeconds` and Environment fields;
- optional Reward Dice with trigger Phase type, frequency, rerolls and sides;
- each stored side's normalized Domain probability under `probability`.

Reads accept versions 1–2. Version 1 Environment objects accept only legacy
`backgroundAssetId`, `audioAssetId` and `backgroundColor`; version 2 accepts only
`backgroundAsset`, `audioAsset` and `backgroundColor`. Mixed, unknown and
contradictory fields are rejected, as are invalid order and nested Domain data.

Compatibility defaults:

- missing `rewardDice.triggerPhaseType` is accepted and Domain defaults it to
  `focus`;
- missing `rewardDice.rerolls` is accepted and Domain defaults it to `0`.

Current writes always include both fields. The optional record properties exist
only for backward compatibility.

`save()` preserves an existing row's `order` or appends after the last row.
`delete()` compacts the remaining order indexes. `replaceOrder()` requires every
existing identifier exactly once.

## Session Records

Sources:

- [`SessionRecord.ts`](../../src/features/session/infrastructure/SessionRecord.ts)
  owns the record and version-2 database fragment.
- [`mapSessionRecord.ts`](../../src/features/session/infrastructure/mapSessionRecord.ts)
  validates the envelope and nested snapshot.
- [`DexieSessionRepository.ts`](../../src/features/session/infrastructure/DexieSessionRepository.ts)
  owns active lookup and save invariants.

The outer record contains:

```ts
{
  id: string;
  schemaVersion: 2;
  active: 0 | 1;
  updatedAt: number;
  session: unknown;
}
```

Version 1 snapshots accept only legacy direct ID Environment fields. Version 2
snapshots accept only exact direct-reference objects; Role references, mixed
versions and unknown Environment fields are rejected. The nested `session`
stores the immutable Workflow snapshot, current Phase index,
state discriminator and the timing fields required by that state. It does not
store a live reference to the Workflow table.

The mapper rebuilds the Workflow with `createWorkflow()` and the Session with
`restoreSession()`, then verifies:

- outer `id` equals reconstructed Session `id`;
- `active` matches the reconstructed state;
- the current Phase index and state-specific anchors are valid;
- terminal and non-terminal variants contain the required facts.

Compatibility defaults apply inside stored snapshots:

- missing Reward Dice trigger Phase type defaults to `focus`;
- missing Reward Dice rerolls defaults to `0`;
- missing Paused Session `pauseReason` defaults to `user`.

The repository rejects more than one stored active Session and prevents saving a
new active identifier while another active row exists.

`updatedAt` is an indexable persistence timestamp selected from the state's
latest anchor. It is not a Domain countdown and is validated only as a number by
the current mapper.

## Asset Records

Sources:

- [`AssetRecord.ts`](../../src/features/assets/infrastructure/AssetRecord.ts)
  owns the record and global version-3/version-4 database fragments.
- [`DexieAssetRepository.ts`](../../src/features/assets/infrastructure/DexieAssetRepository.ts)
  owns validation, Blob mapping and table operations.

Current records store `id`, `schemaVersion: 2`, name, `image | audio` kind, MIME
type, byte size, creation epoch, optional display `role`, matching `roleKey` and
Blob. The reader accepts role-less `AssetRecord` v1 and `AssetRecord` v2 with an
optional Role; v1 Role fields and inconsistent v2 Role keys are rejected. Reads
rebuild the Asset Domain value and verify that Blob size and MIME type equal its
metadata. Writes repeat the same check. A browser `QuotaExceededError` is
normalized to `AssetStorageError`.

Asset listing is ordered by Domain `createdAt` after mapping. Object URLs are not
records and must be revoked by Presentation consumers.

## Settings Value

[`ChromeSettingsRepository`](../../src/features/settings/infrastructure/ChromeSettingsRepository.ts)
reads and writes the raw value under the single `settings` key. It intentionally
returns `unknown`; the Application use case applies the Domain boundary:

- missing storage value → frozen `defaultSettings`;
- present storage value → `createSettings()` validation;
- update/import input → validate first, then save.

The Settings object accepts only `theme`, `reducedMotion` and optional
`lastSelectedWorkflowId`. It rejects unknown keys and invalid enum/identifier
values. There is no separate Settings database schema or record
`schemaVersion`.

Each extension document independently reads this same key before its first
visible render and listens to `chrome.storage.onChanged` for the local
`settings` key. The per-document controller is not another persistence layer:
it holds only a validated rendering snapshot and effective system-motion value.
Missing, invalid or temporarily unreadable values use existing defaults for
safe document presentation; update/import use cases remain strict. Controllers
unsubscribe from storage and media-query events on document teardown.

## Why Stored Values Enter as `unknown`

TypeScript types do not validate bytes already in a browser profile. Records may
come from an older extension version, interrupted external tooling or corrupted
storage. Repositories therefore assign reads to `unknown` and map them through
runtime checks and Domain constructors.

The same rule applies to JSON import:

```text
text → size check → JSON.parse as unknown → envelope validation
     → nested validation → Domain construction → persistence
```

Do not cast raw records or parsed JSON to Domain types. A public package is also
not a Dexie record: it uses a separate versioned transport shape and never
exposes `order`, `active`, `updatedAt`, record `schemaVersion` or IndexedDB index
choices.

## Transaction Boundaries

### Single-table operations

- Workflow `save`, `delete` and `replaceOrder` use an explicit read-write
  transaction on `workflows` because each operation performs dependent reads and
  writes.
- Session `save` uses an explicit read-write transaction on `sessions` to check
  the one-active-Session invariant and write atomically.
- Asset `put` and `delete` are single Dexie table operations and use their
  operation's IndexedDB transaction.
- Reads map only after the table operation returns and fail rather than returning
  untrusted partial Domain values.

### Asset retirement

`DexieAssetRetirementUnitOfWork` opens one read-write transaction covering
`assets`, `workflows` and `sessions`. Inside it the Application rechecks active
Session use and the authoritative Workflow usage preview, then performs any new
Asset upload, Workflow reference rewrites/removals, Role transfer and source
deletion. A failure at any participating write aborts every earlier write, so a
failed upload cannot become orphaned and a Workflow cannot retain a dangling
direct reference. This changes no stored shape and keeps global Dexie version 4.
Catalog-event publication and Options reload occur after commit. Their failure
is recoverable through synchronization-only retry and never resubmits the
durable retirement transaction.

### Workflow package import

[`DexieWorkflowPackageUnitOfWork`](../../src/features/workflow/infrastructure/DexieWorkflowPackageUnitOfWork.ts)
opens one read-write transaction covering `workflows` and `assets`. Before this
transaction, `importWorkflowUseCase` validates:

- UTF-8 file size, JSON, exact envelope kind/version and Workflow shape;
- every Base64 payload, declared size, kind, MIME policy and Domain Asset;
- unique source Asset identifiers;
- exact agreement between referenced Assets and embedded Assets, including
  image/audio kind, direct-or-Role mode and Role kind resolution;
- new unique Asset and Workflow identifiers.

It rewrites direct references to new local identifiers and collision-renamed
Roles to their imported names. Role suffix generation continues while the
suffix fits the 64-code-point Role contract; it has no arbitrary attempt cap.
Only then does the unit of work save all Assets and the Workflow. Any thrown write
rolls back both tables, so no partial imported package remains.

Export performs the inverse public operation: it sorts referenced identifiers,
requires metadata and Blob content for each, Base64-encodes them, and writes a
`locusora/workflow` version-2 envelope. The package is a transport contract, not
a storage dump.

### Settings import

Settings import has a separate `locusora/settings` version-1 envelope. It
validates file size, exact envelope keys and Domain Settings, then performs one
`chrome.storage.local.set`.

Chrome Storage cannot participate in a Dexie transaction. This is safe for the
current separate Settings-only package; do not create an import that pretends a
Chrome Storage write and IndexedDB writes are atomically committed together.

## Migration Procedure

Follow this order for every persistence change:

1. Identify the owning feature record and whether the change affects database
   structure, stored serialization, public packages or several of them.
2. Allocate the next global Dexie version—currently 5—and never reuse or
   independently number a feature version.
3. Keep store definitions cumulative and update every production composition
   root with the identical ordered fragment set.
4. Update the owning record type, runtime mapper and Domain compatibility
   behavior. Preserve explicit defaults only when their semantics are safe.
5. If existing rows must be transformed, add an explicit Dexie `upgrade()` step
   before release. The current `DatabaseSchema` supports additive `stores`
   fragments only, so extend the schema-composition contract rather than hiding
   a transformation in a repository read.
6. Increment a record `schemaVersion` only when its serialization strategy
   requires it; do not mechanically match the Dexie version.
7. Evolve Workflow or Settings package versions independently. Keep an importer
   for every supported version or reject it explicitly.
8. Add repository tests for old records, new writes, corrupt data and migration
   results.
9. Add import/export compatibility tests when a Domain field, Asset reference or
   public envelope changes.
10. Verify all runtime contexts open the same schema and run typecheck, lint,
    focused repository tests, the complete test suite and production build.

Never use database deletion as a migration, silently reinterpret existing data,
or rely on a mapper default for a transformation that must be materialized.

## Related Decisions

- [ADR-0005](../adr/ADR-0005-local-first-persistence.md): local persistence
  ownership and storage split.
- [ADR-0007](../adr/ADR-0007-versioned-import-export.md): public packages,
  validation, new identities and atomic import.
- [ADR-0010](../adr/ADR-0010-indexeddb-schema-composition.md): global database
  version allocation and feature-owned fragments.
- [State and Data Flow](STATE_AND_DATA_FLOW.md): runtime versus durable state.
