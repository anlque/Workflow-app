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
and serialized command handling. A bounded receipt history is stored in the
Session aggregate, making retained roll, reroll and continue IDs idempotent
across worker restarts. Presentation owns animation and projection-transition
sound cues only.
The target supports the conceptual distinction between the next normal Phase,
Session completion and a future Bonus Phase; RW-003 implements only the first
two. Bonus configuration and execution remain RW-004 and RW-005.

## Alternatives Considered

- Keep dialog-local state: rejected because reload and cross-surface behavior is
  nondeterministic.
- Persist a separate Reward UI record: rejected because it creates a second
  source of truth outside Session transitions.
- Store only the result: rejected because reroll accounting and continuation
  would remain non-authoritative.

## Consequences

Session persistence and runtime messages gain a new canonical version. Commands
become deterministic in tests and safe under retries. Final completion waits for
explicit Reward acknowledgment. Presentation becomes simpler, while Session
transition coverage and compatibility readers become more extensive.

## Related Documents

- ADR-0003
- ADR-0004
- `docs/development/flows/REWARD_DICE.md`

## Supersedes

The earlier documented constraint that Reward ritual state is local to
`RewardResultDialog`.
