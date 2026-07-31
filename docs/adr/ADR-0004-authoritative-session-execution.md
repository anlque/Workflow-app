# ADR-0004

Coordinate Authoritative Session Execution in the Background

Status: Accepted

Date: 2026-07-31

---

## Context

Manifest V3 service workers are suspended, extension surfaces have independent
memory, and JavaScript intervals are not a reliable time authority. Session state
must survive closing and reopening UI surfaces without drift.

## Decision

The background service worker is the authoritative coordinator for active Session
commands. Application use cases persist state transitions atomically. Running
Phases store wall-clock timing anchors; remaining time is derived from timestamps,
not a decremented counter. Chrome alarms are wake-up signals, not clocks.

Side panel and focus view request snapshots and send typed commands. The service
worker validates commands, persists the new state and broadcasts a typed state
change. On startup or wake, it restores and reconciles the persisted active
Session. Commands carry identifiers that allow duplicate delivery to be handled
idempotently.

## Alternatives Considered

- UI-owned interval: simple, but loses authority when the UI closes.
- Long-lived service-worker interval: incompatible with MV3 suspension.
- Zustand synchronization: stores do not share memory across contexts.

## Consequences

Session timing survives suspension and has one owner. Messaging, persistence and
clock abstractions require integration tests. Alarm delivery can be late, so UI
state may advance immediately when derived timestamps show a Phase has elapsed.

## Related Documents

- `docs/concepts/03_ARCHITECTURE.md`
- `docs/concepts/06_TECH_STACK.md`
- `docs/concepts/08_TESTING_STRATEGY.md`

