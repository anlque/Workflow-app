# ADR-0007

Use Versioned and Atomic Import and Export

Status: Accepted

Date: 2026-07-31

---

## Context

Imported files are untrusted runtime data and persisted formats will evolve.
Partial imports, identifier collisions and silent schema changes would damage
local data.

## Decision

Define separate versioned JSON envelopes for Workflow packages and settings.
Workflow packages include the Workflow snapshot plus referenced local Assets
encoded for transport. Settings packages contain only supported settings. Validate
file size, envelope version, schema, invariants, MIME types and decoded Asset
sizes before starting a transaction.

Import is atomic. Generate new identifiers for imported Workflows and Assets and
rewrite internal references, preserving existing local records. Reject unknown
major versions and corrupted packages without writes. Export ordering is stable
to support deterministic tests.

## Alternatives Considered

- Export storage records directly: couples public files to persistence schemas.
- Overwrite colliding identifiers: risks unintended data loss.
- Best-effort partial import: leaves difficult-to-explain incomplete state.

## Consequences

Imports are safe, migration paths are explicit and storage remains private.
Embedding Assets increases file size. Each new envelope version requires
compatibility tests and, when supported, a dedicated importer.

## Related Documents

- `docs/concepts/01_PRODUCT_SPECIFICATION.md`
- `docs/concepts/08_TESTING_STRATEGY.md`
