# ADR-0011

Global Asset Roles and Transactional Retirement

Status: Accepted

Date: 2026-09-07

---

## Context

Users need one named Role, such as `fav focus`, that can move between Assets and
affect future Sessions without mutating an active Session. Uniqueness, package
collisions and future retirement cross feature boundaries.

## Decision

Assets owns optional `AssetRole`, Unicode/whitespace normalization and a global
case-insensitive key. IndexedDB enforces the key with one unique index across
both Asset kinds. Role movement clears the old owner and assigns the target in
one transaction; it never overwrites a different target Role implicitly.

Workflow Environment uses an explicit direct-or-Role reference. Workflow
Application resolves Roles through an injected port and verifies image/audio
kind. Session Application receives a resolver through composition and Session
Domain rejects Role references in snapshots. Active snapshots therefore contain
concrete IDs and remain authoritative after Role movement.

Workflow package version 2 transports Role metadata and reference unions. Import
accepts version 1 direct packages, creates fresh IDs and deterministically
renames Role collisions. Imported references are remapped to imported Assets in
the same Workflow-and-Assets transaction, never to an existing local owner.

Assets preserves the ST-005 injected active-Session-reference port and never
imports Session internals.

For AS-003, retirement will apply the active-Session guard and then combine
same-kind direct-reference replacement/removal, Role transfer and Asset
retirement in one transaction. This boundary is accepted but not implemented by
AS-001.

## Alternatives Considered

- Parallel direct-ID and Role fields permit contradictory states.
- Focus-time resolution makes active execution depend on mutable catalog data.
- Preflight-only uniqueness cannot prevent concurrent IndexedDB writes.

## Consequences

Future Sessions follow Role movement while active Sessions remain stable.
Readers retain explicit legacy paths. Cross-kind movement can make a Workflow
fail kind validation until corrected. Role UI and retirement remain AS-002 and
AS-003.

## Supersedes

- [ADR-0006](ADR-0006-local-asset-lifecycle.md)

## Related Documents

- [ADR-0003](ADR-0003-workflow-aggregate-session-snapshot.md)
- [ADR-0007](ADR-0007-versioned-import-export.md)
- [ADR-0009](ADR-0009-minimal-shared-kernel.md)
- [ADR-0010](ADR-0010-indexeddb-schema-composition.md)
