# ADR-0014

Seed Starter Content Once with an Append-Only Version Registry

Status: Accepted

Date: 2026-10-15

---

## Context

Locusora bundles offline starter media so a fresh profile is useful before the
user imports anything. Seed installation must remain local-first, preserve all
user data, survive concurrent extension bootstraps and allow later releases to
add independent starter-content batches. A single boolean marker cannot express
that history, and ordinary repository `save()` operations may overwrite records
whose deterministic identifiers already exist.

The initial batch contains only the five image and three audio Assets approved
in SEED-002. Example Workflows belong to SEED-003 and must remain installable for
profiles that have already completed the Asset batch.

## Decision

Create a focused `starter-content` feature. Its Application layer coordinates
versioned seed definitions through injected packaged-file loading, completion
registry and transaction ports; it imports neither browser APIs nor Dexie.

Add an append-only `starterContentSeeds` store in global Dexie version 5. Each
record identifies one completed positive integer seed version and records its
completion time. No production operation removes a record. Every production
composition root supplies the same complete schema fragment set.

Each seed version has deterministic namespaced record identifiers. Version 1
creates only the SEED-002 Assets, using IDs of the form
`locusora:seed:v1:asset:<seed-key>`. Version 2 creates the three SEED-003 example
Workflows independently; the version-1 marker cannot suppress it.
After creation, seeded Assets and Workflows are ordinary user-owned local
records. Deleting or editing them does not change the registry, and a later
startup never restores deleted records from an already completed version.

The Application service performs a read-only marker check before loading files
so an ordinary repeated startup performs no loading or writing. For an
unfinished version it loads every packaged file and validates all Asset and
Workflow values before opening the write transaction. The transaction then:

1. rechecks the version marker for concurrency safety;
2. checks every deterministic Asset and Workflow ID;
3. checks every normalized Asset Role through its canonical comparison key;
4. adds all records with insert-only semantics;
5. adds the completed-version marker last.

The Infrastructure unit of work owns the Dexie transaction over the registry,
Assets and Workflows. Any load, validation, conflict, record write or marker
write failure leaves no new record. Concurrent attempts serialize through the
same tables; the later transaction observes the marker and becomes a no-op.

The background bootstrap creates the database and synchronously registers the
toolbar, runtime-message and alarm listeners before its first asynchronous
operation. Their handlers share one readiness barrier and cannot perform
database-dependent behavior until all declared seed versions complete in
ascending order and the Session coordinator restores authoritative state. An
event that wakes the MV3 worker is therefore accepted immediately and waits for
readiness instead of being lost. A seeding or restoration failure rejects both
initialization and queued request/command operations; alarm failures are
reported through the coordinator error boundary rather than leaking an
unhandled rejection. UI composition roots do not independently seed content,
but they include the same schema set so every runtime context opens the same
database version.

## Alternatives Considered

- Store one boolean such as `starterContentSeeded`: simple, but it prevents an
  independent future Workflow batch and loses append-only execution history.
- Reuse Workflow package import: its identity remapping and merge rules are
  correct for user imports but conflict with deterministic IDs and strict
  no-overwrite seeding.
- Run the seed coordinator in every UI surface: transactionally safe, but it
  creates needless file loading and makes startup ordering harder to reason
  about. The background remains the single initialization owner.
- Put the registry in generic Platform storage: centralizes schema knowledge,
  but makes a business-specific lifecycle marker a Platform concern.

## Consequences

Starter batches can evolve independently without restoring content a user has
deleted. Production version 1 is Asset-only and version 2 is Workflow-only, so
profiles that already installed the media receive the examples exactly once.
Conflicts are explicit and never overwrite local data. Atomicity spans Assets,
Workflows and the marker, while browser and Dexie details remain outside
Application.

The database gains an additive global version and every production composition
root must include its fragment. Startup now depends on packaged-file validation;
an invalid release asset prevents initialization instead of creating a partial
catalog. A later SEED-003 implementation must allocate version 2 in this
registry rather than modifying version 1.

## Related Documents

- `docs/adr/ADR-0002-feature-first-clean-architecture.md`
- `docs/adr/ADR-0005-local-first-persistence.md`
- `docs/adr/ADR-0010-indexeddb-schema-composition.md`
- `docs/development/PERSISTENCE.md`
- `docs/product/STARTER_MEDIA.md`
- `docs/product/STARTER_WORKFLOWS.md`
- `docs/roadmap/PRODUCT_EVOLUTION.md`
