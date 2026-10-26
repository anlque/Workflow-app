# Persistence and Compatibility

## AS-001 compatibility update

Global Dexie version 4 defines `assets: 'id, createdAt, &roleKey'`; global
version 5 adds the append-only `starterContentSeeds` registry. The optional
normalized key is globally unique; role-less rows are not indexed. Asset writers
remain at record version 2; Workflow writers emit record version 7 and Session
writers emit version 10. Their readers retain the compatible older versions. Workflow
and Session indexes are unchanged.

Workflow package export emits version 7 with an explicit Quick/Detailed mode,
while import accepts versions 1–7. Quick v7 payloads store only their source
configuration; Detailed v7 payloads retain optional Phase names, canonical
Reward schedules, canonical Dice Side availability, optional Bonus Reward
Phases and direct-or-Role references. Embedded Assets retain optional Roles.
Local collisions become
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
| Completed starter-content versions | IndexedDB database `locusora`, table `starterContentSeeds` | Primary `version`; index `completedAt` | `DexieStarterContentUnitOfWork` | Append-only marker history; deleting a seeded record never removes its completed marker |
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
  ...starterContentDatabaseSchemas,
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
| 5 | Starter content | `starterContentSeeds: 'version, completedAt'` | `workflows`, `sessions`, `assets`, `starterContentSeeds` |

Versions belong to the complete database, not to a feature. The next schema
change uses global version 6 regardless of which feature owns it. Store
definitions must remain cumulative.

The background, focus, Options and side-panel production composition roots all
use `createProductionDatabase()` to register versions 1–5 in this order. Focus
and side panel include tables they do
not currently query so that opening any context creates the same database
schema. Focused repository tests may compose only the minimum fragments required
by that test database.

## Dexie Version vs Record `schemaVersion`

These version numbers solve different compatibility problems:

| Version | Scope | Current value | Changes when |
| --- | --- | --- | --- |
| Dexie database version | Whole `locusora` database structure and upgrade order | 1–5 history; current 5 | A table/index changes or existing stored data needs a database migration |
| `WorkflowRecord.schemaVersion` | One Workflow record serialization shape | Current writes 7; reads 1–7; versions 1–6 map to Detailed | The Workflow record reader/writer needs a new incompatible serialization |
| `SessionRecord.schemaVersion` | One Session record envelope | Current writes 10; reads 1–10 | The Session record reader/writer needs a new incompatible serialization |
| `AssetRecord.schemaVersion` | One Asset record shape | Current writes 2; reads role-less 1 and 2 | The Asset record reader/writer needs a new incompatible serialization |
| Workflow package `version` | Public `locusora/workflow` import/export envelope | Current export 7; import 1–7; versions 1–6 map to Detailed | The external Workflow package contract changes |
| Settings package `version` | Public `locusora/settings` import/export envelope | Current export 4; import 1–4 | The external Settings package contract changes |

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

- `id`, current `schemaVersion: 7`, `order`, `name` and explicit mode;
- ordered Phase values with optional `name`, `type`, `durationSeconds` and Environment fields;
- optional Reward Dice with one canonical `frequency | custom` schedule,
  rerolls and sides;
- each stored side's normalized Domain probability under `probability`, required
  `availability: any | early | late` and optional Bonus Reward Phase.

Detailed v7 stores the Phase/Reward fields above. Quick v7 instead stores its
cycle source configuration and omits generated `phases` and top-level
`rewardDice`.

Reads accept versions 1–7. Versions 1–6 map to Detailed. Version 1 Environment objects accept only legacy
`backgroundAssetId`, `audioAssetId` and `backgroundColor`; version 2 accepts only
the direct-or-Role reference fields and legacy frequency configuration. Version
3 keeps those Environment references and stores the canonical schedule. Version
4 additionally requires canonical Side availability. Version 5 permits the
exact optional Bonus shape. Version 6 additionally permits the optional Phase
name. Version 7 requires the exact mode-specific shape. Mixed, unknown and
contradictory fields are rejected, as are invalid order and nested Domain data.

Compatibility defaults:

- missing legacy `rewardDice.triggerPhaseType` is accepted and Domain defaults it to
  `focus`;
- missing `rewardDice.rerolls` is accepted and Domain defaults it to `0`.

Current writes use the canonical schedule. Legacy properties exist only at read
boundaries.

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
  schemaVersion: 10;
  active: 0 | 1;
  updatedAt: number;
  session: unknown;
}
```

Version 1 snapshots accept only legacy direct ID Environment fields. Versions
2–10 accept only exact direct-reference objects; Role references, mixed
versions and unknown Environment fields are rejected. Versions 1–2 read legacy
top-level Reward `triggerPhaseType + frequency` fields and default a missing
trigger type to `focus`; versions 3–10 require the canonical `frequency | custom`
schedule union, including `triggerPhaseType` for frequency. Versions 4–10 require
canonical Side availability; versions 1–3 default it to `any`. Versions 6–10
accept optional exact Bonus configuration; versions 1–5 do not. Versions 7–10 add
the optional exact active Bonus marker and permit `restart` Reward-command
receipts; versions 1–6 restore without an active Bonus marker. Versions 8–10
accept optional Phase names. Version 9 requires exact bounded restart-command
receipts; versions 1–8 restore an empty restart history. The nested `session`
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

- missing legacy Reward Dice trigger Phase type defaults to `focus`;
- missing Reward Dice rerolls defaults to `0`;
- missing Paused Session `pauseReason` defaults to `user`.
- versions 1–9 restore empty skip receipts; legacy Transitioning records restore
  an `ordinary-phase / elapsed` descriptor. Version 10 requires exact skip
  receipts and transition metadata.

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

The Settings object accepts theme/motion, canonical ambient/cue channels,
background blur/brightness and optional `lastSelectedWorkflowId`. It
rejects unknown, partial or invalid fields. Unversioned persisted v1/v2 shapes
receive the documented newer defaults; a present appearance group must be
complete. There is no separate Settings database schema or record
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

### Starter-content installation

`seedStarterContentUseCase` checks its append-only version marker before loading
packaged files. It then loads and validates every Asset and constructs every
Workflow before opening a transaction. Inside one `assets` + `workflows` +
`starterContentSeeds` transaction it rechecks the marker, rejects existing
deterministic IDs or normalized Roles, inserts without merging and adds the
marker last. Any failure rolls back the complete version. A completed marker
makes later runs a no-op, so user-deleted starter records are not restored.
Production version 1 owns the eight approved starter Assets; version 2 owns
the three ordinary example Workflows. Each version executes independently once.

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
`locusora/workflow` version-3 envelope. The package is a transport contract, not
a storage dump.

### Settings import

Settings import has a separate `locusora/settings` envelope. Version 1 carries
legacy theme/motion/shared-volume data; version 2 requires canonical independent
ambient/cue channels; version 3 additionally requires canonical blur and
brightness; version 4 adds the required `pauseWithSpace` control. Versions 1–3
default that preference to `true`. It validates file size, exact version-specific
keys and Domain Settings, then performs one `chrome.storage.local.set`.

Chrome Storage cannot participate in a Dexie transaction. This is safe for the
current separate Settings-only package; do not create an import that pretends a
Chrome Storage write and IndexedDB writes are atomically committed together.

## Migration Procedure

Follow this order for every persistence change:

1. Identify the owning feature record and whether the change affects database
   structure, stored serialization, public packages or several of them.
2. Allocate the next global Dexie version—currently 6—and never reuse or
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
