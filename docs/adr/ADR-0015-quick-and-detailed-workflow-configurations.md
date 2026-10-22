# ADR-0015

Represent Quick and Detailed Workflows as Configuration Variants

Status: Accepted

Date: 2026-10-21

---

## Context

People need a compact, repeatedly editable focus rhythm without losing the
existing unrestricted Workflow model. Persisting both compact settings and
generated Phases would create competing sources of truth, while a separate
Quick Session path would duplicate authoritative execution behavior.

## Decision

`Workflow` is a `QuickWorkflow | DetailedWorkflow` union. Detailed is the
default for legacy constructor inputs, stored records, packages and starter
content. A Quick Workflow persists only its validated cycle configuration and
deterministically materializes ordinary immutable Phases and canonical Reward
Dice for current consumers.

Workflow record and package version 7 encode the configuration mode explicitly.
Quick payloads contain source configuration but no generated Phases; Detailed
payloads retain the existing Phase/Reward representation. Record/package
versions 1–6 map to Detailed. Table keys and indexes are unchanged, so the
Dexie database schema is not incremented.

Application operations traverse source Environments: Detailed Phase/Bonus
Environments or Quick Focus/Short Break/Long Break Environments. Duplication,
Role resolution/rename, package remapping and Asset retirement therefore
preserve Quick editability. Ordinary update rejects mode changes. One-way
Quick-to-Detailed conversion is reserved for QUICK-003.

Session receives only the resolved materialized projection. Snapshot creation
copies it into a Session-owned mode-free executable Workflow shape, so Session Domain, persistence, messaging
and timing remain mode-independent.

## Alternatives Considered

- Persist generated Quick Phases beside settings: rejected because it creates
  two editable sources of truth.
- Convert Quick to Detailed on every save: rejected because compact editing
  would not remain available.
- Add a Quick Session aggregate: rejected because execution behavior is already
  fully represented by the existing Phase/Reward model.

## Consequences

Quick configuration remains losslessly editable and all existing execution
code stays shared. Source-aware Asset operations avoid repeated mutations of
generated Phases. Persistence and package readers gain another strict version,
while IndexedDB schema and Session formats remain unchanged. Presentation for
Quick Setup and conversion are intentionally deferred.

## Related Documents

- `docs/adr/ADR-0003-workflow-aggregate-session-snapshot.md`
- `docs/adr/ADR-0007-versioned-import-export.md`
- `docs/adr/ADR-0011-global-asset-roles-and-transactional-retirement.md`
- `docs/superpowers/specs/2026-10-16-quick-workflows-design.md`
- `docs/development/features/WORKFLOW.md`
