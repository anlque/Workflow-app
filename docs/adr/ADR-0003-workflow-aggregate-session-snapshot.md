# ADR-0003

Use a Workflow Aggregate and Immutable Session Snapshot

Status: Accepted

Date: 2026-07-31

---

## Context

Workflow configuration, Phase ordering, Environment and Reward Dice have shared
invariants. A running Session must not change when its source Workflow is edited
or deleted.

## Decision

Workflow is the aggregate root for its ordered Phases, their Environments and its
optional Reward Dice. The MVP Workflow Library is a repository-backed collection,
not a persisted aggregate. Starting a Workflow validates it and copies the full
execution configuration into an immutable Session snapshot. Session retains the
source Workflow identifier for traceability but executes only the snapshot.

The MVP supports `focus` and `break` Phases, executes the ordered sequence once
and permits one active Session. Reward Dice is evaluated only after completed
focus Phases. Reward Dice Templates are future scope.

## Alternatives Considered

- Session reads the live Workflow: less duplication, but edits make execution
  nondeterministic and deletion breaks history.
- Independent Phase and Reward Dice aggregates: flexible, but creates needless
  cross-feature coordination for objects owned by Workflow.

## Consequences

Execution and history are reproducible. Session records duplicate configuration
and require versioned serialization. Workflow updates do not migrate existing
Session snapshots.

## Related Documents

- `docs/concepts/01_PRODUCT_SPECIFICATION.md`
- `docs/concepts/02_DOMAIN_MODEL.md`

