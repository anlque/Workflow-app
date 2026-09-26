# ADR-0012

Authoritative Reward ritual and Bonus Reward Phases

Accepted

2026-09-21

---

## Context

Reward results and rerolls were owned by a React dialog, so document teardown
could lose a result and final Rewards could complete before acknowledgment.
Future Bonus Reward Phases also require a durable continuation target.

## Decision

The Session aggregate owns Reward opportunity identity, selected Side, rerolls
used, acknowledgment and a discriminated continuation target. Background
Application commands perform roll, reroll and continue with injected randomness
and serialized command handling. A bounded receipt history stores the full
`commandId + command type + Reward ritual ID` fingerprint in the Session
aggregate; Session scope is enforced by the Application/coordinator boundary.
Only an exact retained fingerprint is an idempotent no-op across worker
restarts, while identifier collisions and commands for a stale opportunity are
rejected. Presentation owns animation and projection-transition sound cues only.
The target supports the conceptual distinction between the next normal Phase,
Session completion and a Bonus Phase. RW-004 adds one optional immutable Bonus
Reward Phase configuration (`name`, `durationSeconds`, `environment`) to each
Dice Side and preserves it through Workflow/package/Session boundaries. RW-005
executes that configuration through the same authoritative Session clock. An
acknowledged ritual may carry an exact `activeBonusPhase` marker that points to
its selected Side while retaining the normal `phase | complete` continuation.
Bonus is not a Workflow phase index: expiry returns directly to the saved normal
target, never creates a nested Reward, and a final Bonus delays completion until
its own deadline. Pause/resume reuse Session anchors. `session/restart-phase`
resets only an active Bonus to its configured full duration; ordinary Phase
restart remains deferred to FX-002.

## Alternatives Considered

- Keep dialog-local state: rejected because reload and cross-surface behavior is
  nondeterministic.
- Persist a separate Reward UI record: rejected because it creates a second
  source of truth outside Session transitions.
- Store only the result: rejected because reroll accounting and continuation
  would remain non-authoritative.

## Consequences

Session persistence and runtime messages gain new canonical versions. Session
record v7 persists the optional active Bonus marker and `restart` receipts while
versions 1–6 remain readable without that execution marker. Commands become
deterministic in tests and safe under retries. Final completion waits for
explicit Reward acknowledgment and, when selected, final Bonus completion.
Presentation derives the visible name and Environment from the immutable
snapshot; it owns no Bonus timer. Session transition coverage and compatibility
readers become more extensive.

## Related Documents

- ADR-0003
- ADR-0004
- `docs/development/flows/REWARD_DICE.md`

## Supersedes

The earlier documented constraint that Reward ritual state is local to
`RewardResultDialog`.
