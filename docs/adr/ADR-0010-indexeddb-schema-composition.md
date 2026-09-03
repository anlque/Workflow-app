# ADR-0010

Compose One IndexedDB Schema from Feature-Owned Fragments

Status: Accepted

Date: 2026-08-24

---

## Context

Workflows, Sessions and Assets require structured and transactional local
storage. They share the `locusora` IndexedDB database so cross-feature
operations such as Workflow package import can update Workflow and Asset tables
atomically. Each feature still owns its records, mappers and repository adapter.

Dexie database versions apply to the whole database, not an individual feature.
Independent feature schemas therefore need an explicit composition and version
allocation rule.

## Decision

Use one Dexie database named `locusora`. Feature Infrastructure exports ordered
schema fragments for the tables it owns. Every runtime context that opens the
database composes the same complete set of fragments through
`LocusoraDatabase`.

Database version numbers form one global, monotonically increasing sequence
across all features. A new schema change takes the next project-wide integer;
features must not allocate versions independently or reuse a number. Store
definitions are cumulative across versions.

Feature record `schemaVersion` values are serialization versions for individual
records and are independent of the Dexie database version. They must not be used
as substitutes for database migration ordering.

The feature that owns a changed record owns its validation, mapping and migration
logic. A change that transforms existing data must add an explicit Dexie upgrade
step before release; adding a new store may use an additive schema fragment when
no existing record requires transformation. Transactions spanning several
features use an Application-owned unit-of-work contract implemented by
Infrastructure.

## Alternatives Considered

- Separate IndexedDB database per feature: stronger physical isolation, but no
  atomic Workflow-and-Asset imports and more lifecycle coordination.
- One centralized schema file owning every record: easy version allocation, but
  moves feature-specific persistence knowledge out of its owner.
- Independently version each feature fragment: locally convenient, but invalid
  because Dexie versions belong to the composed database.

## Consequences

Features retain record ownership while the application can perform atomic
cross-feature transactions. Every schema change requires project-wide version
coordination, and all composition roots must use the same fragment list. Missing
or differently ordered fragments are integration errors and require tests.

## Related Documents

- `docs/adr/ADR-0005-local-first-persistence.md`
- `docs/adr/ADR-0007-versioned-import-export.md`
- `docs/concepts/04_FOLDER_STRUCTURE.md`
- `docs/concepts/06_TECH_STACK.md`
