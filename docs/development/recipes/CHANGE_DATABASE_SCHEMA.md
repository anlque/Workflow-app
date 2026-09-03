# Change the IndexedDB Schema

## Use When

Use this recipe when IndexedDB tables, indexes or stored data require an ordered
Dexie schema change. A compatible optional record field that needs no index or
materialized transformation may require only a mapper change; verify that claim
through the [Persistence reference](../PERSISTENCE.md) before skipping a database
version.

This recipe does not apply to the independent `chrome.storage.local` Settings
value unless the change also affects IndexedDB.

## Before Editing

1. Identify the owning feature record, mapper and repository.
2. Separate three independent versions:
   - global Dexie database structure/history;
   - feature record `schemaVersion`;
   - public Workflow/Settings package `version`.
3. Inspect every current schema fragment and the complete composition in
   background, focus, Options and side panel.
4. Decide whether old rows remain valid as read, need a safe mapper default or
   require a materialized transformation.
5. Read [ADR-0005](../../adr/ADR-0005-local-first-persistence.md),
   [ADR-0010](../../adr/ADR-0010-indexeddb-schema-composition.md) and the
   [migration procedure](../PERSISTENCE.md#migration-procedure).
6. Reconfirm the persistence/offline ownership in the
   [Technology Stack](../../concepts/06_TECH_STACK.md).
7. Capture representative old records in tests before changing the reader.

## Likely Owners

| Concern                                      | Owner                                                |
| -------------------------------------------- | ---------------------------------------------------- |
| Feature record and schema fragment           | `src/features/<feature>/infrastructure/*Record.ts`   |
| `unknown` → Domain mapping and serialization | feature Infrastructure mapper/repository             |
| Cumulative schema assembly                   | `src/platform/storage/LocusoraDatabase.ts`          |
| Complete production fragments                | background and three UI dependency composition roots |
| Cross-table atomic operation                 | owning feature unit-of-work adapter                  |
| Public package compatibility                 | Workflow or Settings Application package modules     |
| Migration/compatibility proof                | feature repository tests using fake IndexedDB        |

Platform remains business-independent: it applies generic schema definitions but
does not import feature concepts or decide their transformation.

## Ordered Steps

1. Add a failing repository test that opens the previous schema/data and states
   the expected post-upgrade Domain value and stored shape.
2. Allocate the next global Dexie version. The current history ends at 3, so the
   next version is 4 regardless of which feature owns the change.
3. Add the feature-owned schema fragment with only its new/changed store
   definitions. `LocusoraDatabase` accumulates prior definitions; never reuse or
   independently number a feature version.
4. Keep the effective stores cumulative. Verify that a new database opened at
   the latest version contains Workflow, Session and Asset tables.
5. If existing rows need transformation, extend the generic `DatabaseSchema`
   composition contract to carry an explicit Dexie `upgrade()` operation. The
   current contract supports additive `stores` fragments only; do not hide a
   required write transformation in routine repository reads.
6. Implement the owning transformation from the old persisted shape to the new
   persisted shape. Validate assumptions and make repeated/partial upgrade
   handling deterministic.
7. Update the record type, runtime mapper and serializer. Keep raw reads as
   `unknown` until all record and Domain invariants pass.
8. Increment the feature record `schemaVersion` only if its serialization
   contract becomes incompatible. Add explicit readers/migration behavior for
   supported old versions.
9. Update all four production compositions with the identical complete ordered
   fragment set:
   - `src/app/background/bootstrapBackground.ts`;
   - `src/app/focus/createFocusDependencies.ts`;
   - `src/app/options/createOptionsDependencies.ts`;
   - `src/app/side-panel/createSidePanelDependencies.ts`.
10. Update cross-table transaction scopes when a new table participates in an
    atomic use case.
11. Review Workflow/Settings public packages separately. Change their envelope
    versions only when the transport contract requires it.
12. Build the extension and test both fresh database creation and upgrade from
    realistic previous records.

## Compatibility Checks

- **Version allocation:** is the new number global and strictly greater than 3?
- **All contexts:** can any runtime be the first to open the same database and
  produce the identical schema?
- **Cumulative stores:** do earlier tables remain defined at the latest version?
- **Transformation:** is required data rewritten explicitly and atomically?
- **Record version:** is it intentionally independent from the Dexie version?
- **Domain boundary:** are old/new rows reconstructed through Domain constructors?
- **Active Session:** can a stored Running/Transitioning/Paused Session restore
  without losing timing or snapshot semantics?
- **Transactions:** do multi-record invariants remain atomic on thrown writes?
- **Packages:** is import/export compatibility tested independently under
  [ADR-0007](../../adr/ADR-0007-versioned-import-export.md)?
- **Rollback strategy:** a released bad migration is corrected by a new forward
  version. Never reuse a version or erase user data to move backward.

## Tests

Run the owning repository first, then all persistence owners:

```bash
pnpm vitest run src/features/workflow/infrastructure
pnpm vitest run src/features/session/infrastructure src/features/assets/infrastructure
pnpm vitest run tests/architecture/importBoundaries.test.ts
```

Required cases:

- fresh database at the latest global version;
- upgrade from the previous version with representative rows;
- new write/read round-trip;
- supported legacy record/version;
- malformed record rejection;
- transaction rollback on a thrown participating write;
- every production composition includes the same fragments;
- affected public package round-trip/no-partial-write behavior.

Finish with typecheck, lint, full Vitest, production build and relevant E2E
restoration/import journeys.

## Documentation Impact

Update:

- [Persistence and Compatibility](../PERSISTENCE.md): effective version table,
  record fields, defaults, transaction and migration procedure;
- owning feature reference;
- [State and Data Flow](../STATE_AND_DATA_FLOW.md) if authority/lifetime changes;
- [Import and Export](../flows/IMPORT_EXPORT.md) when packages change;
- [ADR-0010](../../adr/ADR-0010-indexeddb-schema-composition.md) only by a new
  superseding ADR if the accepted composition strategy changes;
- test/debug playbooks when failure diagnosis changes.

## Stop and Reconsider If

- a feature-local version is being allocated instead of the next global version;
- one composition root would open a different schema;
- a required transformation is being deferred to an incidental read;
- the Dexie number, record version and package version are being synchronized
  mechanically;
- old data is cast into a new type without runtime mapping;
- database deletion is proposed as migration or routine recovery;
- a failed released migration would be edited in place instead of corrected by a
  new forward version;
- Platform would need feature business knowledge to perform the upgrade.
