# Session Feature

## Purpose

The Session feature models one durable execution of an immutable Workflow
snapshot. It owns lifecycle states, timing derivation, pause/continue rules,
Application use cases, persistence and per-document presentation projections.
The background worker composes these parts and remains the authoritative command
coordinator.

Source root: [`src/features/session/`](../../../src/features/session/).

## Owns

- Session identity and the Running, Transitioning, Paused, Completed and Stopped
  variants;
- immutable Workflow snapshot creation and restoration;
- wall-clock timing anchors, remaining-time derivation and Phase advancement;
- user pause/resume, Reward pause/continue and stop transitions;
- Clock and Session repository ports plus lifecycle use cases;
- Session record mapping, active lookup and Dexie repository;
- per-document active projection store, runtime projection parsing and
  connection sequencing;
- reusable active Session view, controls and internal Reward presentation.

## Does Not Own

- reusable Workflow editing or Reward Dice configuration;
- Workflow catalog persistence/invalidation;
- authoritative Chrome message/alarm orchestration—the background `app`
  composition owns it;
- Chrome runtime transport or alarm implementation;
- focus Environment media, completion sound synthesis or side-panel navigation;
- persisted Reward outcomes, reroll history or statistics.

## Public API

External consumers import only from `@/features/session`. The root currently
exports:

| Group | Exports |
| --- | --- |
| Application contracts/errors/events | `Clock`, `SessionRepository`, `SessionChangedEvent`, `SessionApplicationError` |
| Application use cases | `advanceSessionUseCase`, `continueRewardSessionUseCase`, `getActiveSessionUseCase`, `pauseSessionUseCase`, `resumeSessionUseCase`, `startSessionUseCase`, `stopSessionUseCase` |
| Domain types | `Session`, `SessionId`, `RunningSession`, `TransitioningSession`, `PausedSession`, `CompletedSession`, `StoppedSession`, `RestoreSessionInput`, `SessionSnapshot` |
| Domain behavior/errors | `createSession`, `createSessionId`, `restoreSession`, `pauseSession`, `resumeSession`, `continueRewardSession`, `stopSession`, `getRemainingSeconds`, `deriveSessionState`, `SessionValidationError`, `SessionTransitionError` |
| Infrastructure composition | `DexieSessionRepository`, `sessionDatabaseSchemas` |
| Presentation store | `createActiveSessionStore`, `ActiveSessionState`, `ActiveSessionStore` |
| Presentation view | `ActiveSessionView`, `ActiveSessionViewProps` |
| Presentation synchronization | `connectSessionMessages`, `SessionMessageConnection`, `SessionProjectionClient`, `parseSessionProjection` |

`SessionControls`, `RewardResultDialog`, `RewardCube`, countdown/boundary helpers
and Reward transition detection are internal Presentation details. Consumers use
`ActiveSessionView` instead of assembling them directly.

## Internal Layers

### Domain

[`domain/`](../../../src/features/session/domain/) contains the discriminated
union, snapshot copier, timestamp validation, pure state-derivation loop and
Domain errors. It depends on Workflow only through its root public API.

### Application

[`application/`](../../../src/features/session/application/) defines `Clock`,
`SessionRepository`, events/errors and use cases. `loadSession` is an internal
not-found boundary shared by commands.

### Infrastructure

[`infrastructure/`](../../../src/features/session/infrastructure/) owns the
version-1 Session record, global database version-2 schema fragment, runtime
mapping and `DexieSessionRepository`.

### Presentation

[`presentation/`](../../../src/features/session/presentation/) owns Zustand
projection state, message hydration, transport-safe projection parsing,
countdown formatting, controls, Phase-boundary observation and Reward UI.

## Domain Invariants

### Common State

Every Session contains:

- a non-empty branded `SessionId`;
- `sourceWorkflowId` for traceability;
- an immutable deep Workflow snapshot;
- a current Phase index within that snapshot;
- exactly one discriminated state variant.

`createSessionSnapshot()` rebuilds the Workflow with `createWorkflow()`, copying
Phases, Environments, Reward Dice, trigger Phase type, frequency, rerolls and
side values. Source Workflow edits or deletion cannot affect execution.

### State Variants

| State | Required facts | Meaning |
| --- | --- | --- |
| Running | `phaseStartedAt`, `phaseEndsAt` | Current Phase is executing; end is strictly after start |
| Transitioning | `transitionEndsAt` | Authoritative one-second boundary after a completed Phase |
| Paused | `pauseReason: 'user' \| 'reward'`, `pausedAt`, positive `remainingMilliseconds` | Countdown is frozen; allowed continuation depends on reason |
| Completed | `completedAt` | All Phases and the final one-second transition elapsed |
| Stopped | `stoppedAt` | User ended an active Running or Paused Session |

All epoch values must be finite and non-negative. At most one Running,
Transitioning or Paused Session may be active in the repository.

### Timing and Derivation

`deriveSessionState(session, now)` loops while the state is Running or
Transitioning:

1. A Running state remains unchanged before `phaseEndsAt`.
2. At or after that anchor, it becomes Transitioning with
   `transitionEndsAt = phaseEndsAt + 1000`.
3. A Transitioning state remains unchanged before `transitionEndsAt`.
4. At or after it, absence of a next Phase produces Completed at the scheduled
   transition end.
5. If a next Phase exists and Reward is due for the completed Phase, the Session
   becomes Reward-paused on that next Phase with its full duration.
6. Otherwise the next Phase starts at `transitionEndsAt` with full duration.
7. The loop continues, allowing one late wake-up to cross multiple elapsed
   boundaries, but stops at the first Reward pause.

The final Phase completes before the non-final Reward-pause branch is considered.
Therefore an eligible final Reward is a Presentation opportunity over an already
Completed Session, not another authoritative Session state.

### Pause, Continue and Stop

- User pause first reconciles elapsed time and is valid only if the result is
  Running. It stores exact remaining milliseconds.
- Ordinary Resume accepts only a Paused Session with `pauseReason: 'user'` and
  creates fresh anchors from the frozen remainder.
- Reward Continue accepts only `pauseReason: 'reward'` and starts the full next
  Phase from the continuation epoch.
- Ordinary Resume cannot bypass a Reward.
- Stop reconciles first and accepts only Running or Paused; Transitioning and
  terminal states reject it.
- `getRemainingSeconds()` derives a ceiling from Running anchors, uses the frozen
  Paused remainder and returns zero for other states.

## Use Cases

| Use case | Behavior | Persistence result |
| --- | --- | --- |
| `startSessionUseCase` | Requires no active Session, creates snapshot and first Running state using injected clock/ID | Saves new active Session |
| `advanceSessionUseCase` | Loads by ID and derives at current clock | Saves only if the immutable state object changed |
| `getActiveSessionUseCase` | Loads the one active row and reconciles elapsed anchors | Saves changed state; returns only non-terminal result, otherwise `null` |
| `pauseSessionUseCase` | Loads, reconciles and applies user pause | Saves Paused Session |
| `resumeSessionUseCase` | Loads and resumes only user pause | Saves Running Session with new anchors |
| `continueRewardSessionUseCase` | Loads and continues only Reward pause | Saves Running next Phase with new anchors |
| `stopSessionUseCase` | Loads, reconciles and stops a valid active state | Saves Stopped history row |

All clock and repository dependencies are explicit. The use cases do not know
Chrome, alarms, messages or Dexie.

## Persistence

`DexieSessionRepository` stores a version-1 envelope in the global version-2
`sessions: 'id, active, updatedAt'` table definition.

- `getActive()` queries `active = 1` and rejects multiple matches.
- `get()` and `getActive()` validate `unknown` through the record mapper.
- `save()` transactionally prevents another identifier from remaining active.
- the mapper verifies outer ID/active consistency and reconstructs Workflow plus
  Session Domain values;
- missing legacy `pauseReason` defaults to `user`;
- missing legacy Reward trigger type/rerolls inside the snapshot default to
  `focus`/`0`;
- Completed and Stopped records remain as inactive history.

See [Persistence and Compatibility](../PERSISTENCE.md) for the complete record
and migration contract.

## Presentation Consumers

### Projection state

Each focus or side-panel document creates its own `ActiveSessionStore` with
`session`, connection state and error. `connectSessionMessages()` subscribes
before requesting active state and prevents stale hydration from replacing a
newer event. `parseSessionProjection()` rebuilds nested Domain values from
`unknown` runtime payloads.

Zustand is never authoritative and is discarded with its document. See
[State and Data Flow](../STATE_AND_DATA_FLOW.md) and
[Runtime Messaging](../MESSAGING.md).

### Active Session view and controls

`ActiveSessionView` formats the anchor-derived countdown, observes Phase
boundaries, delegates commands and renders terminal summaries. A 250 ms UI
interval only refreshes `now`; it does not decrement or persist Session state.

`SessionControls`:

- shows Pause for Running;
- shows Resume only for user-paused state;
- replaces controls with **Reward pending — open focus view** for a Reward pause;
- hides all controls during Transitioning and terminal states;
- confirms Stop in a Dialog and reports command errors.

Focus provides Reward interaction and sound callbacks. Side panel uses the same
view without Reward interaction, so the focus view is the place that resolves a
Reward pause.

### Non-final Reward

After the background derives a Reward pause, focus detects that authoritative
projection. Initial hydration of an already Reward-paused Session also opens the
dialog. The dialog:

1. waits for **Roll dice** before selecting a side;
2. selects synchronously through injected `rollReward()` randomness;
3. displays mixing for 2500 ms, or 600 ms with reduced motion;
4. permits the configured number of local rerolls and replaces the displayed
   result each time;
5. sends `session/continue-reward` only after **Continue**;
6. stays open and displays an error if continuation fails.

The Session remains authoritatively paused throughout selection and mixing.
Rerolls used and the selected Dice Side are local dialog state; they are not
persisted or broadcast. Reopening a non-final Reward pause starts a fresh UI
roll opportunity for the same unresolved pause.

**Current implementation limitation:** reopening resets `usedRerolls` for the
same pending Reward, although the product rule resets the allowance for a new
Reward rather than a new document. Correcting this requires an explicit owner
and persistence/message contract for Reward interaction progress; it must not be
implemented by making Zustand authoritative.

### Final Reward

After the final transition, Domain returns Completed. Presentation detects one
eligible transition into Completed and overlays the same Reward dialog without
sending a continuation command. The completion record is already terminal;
**Continue** closes the dialog and lets focus schedule the normal completion cue.

This distinction is deliberate:

- non-final Reward → authoritative `Paused(reason: reward)` and background
  continuation;
- final Reward → Completed Session plus transient focus-view ritual.

A final Reward is detected from the observed previous/current projection pair;
hydrating a document after that Completed transition does not reconstruct an
unseen final dialog because no pending Reward state is persisted.

**Current implementation limitation:** if no focus document observes the final
transition, that Reward can be missed. Persisting whether a final Reward was
offered or acknowledged needs a Domain/persistence decision so restoration does
not either lose the Reward or replay it after every reload.

## Dependencies

- Domain depends on Workflow root behavior/types for snapshots and Reward
  eligibility.
- Application depends on Session Domain and Workflow root type for start.
- Infrastructure depends on Session ports/Domain, Workflow root construction,
  `FlowariumDatabase` and Dexie.
- Presentation depends on Session inward modules, Workflow root Reward behavior,
  React, Zustand and shared UI.
- The feature does not import `src/app`, messaging implementations, alarms or
  browser APIs.
- Background `app` composition imports Session and Workflow root APIs and injects
  concrete ports.

## Failure Model

| Failure | Owner | Behavior |
| --- | --- | --- |
| Empty ID, invalid index/timestamp/anchors/remainder or invalid restored snapshot | Domain | Throws `SessionValidationError` |
| Command invalid for current state/reason | Domain | Throws `SessionTransitionError` without a new state |
| Missing Session, second active Session or multiple active rows | Application/repository | Throws `SessionApplicationError` |
| Corrupt persisted record | Infrastructure mapper | Rejects at read boundary; no trusted Session is returned |
| Invalid runtime projection | Presentation parser/client | Rejects initial response or ignores malformed event, preserving current store |
| Runtime command failure | Message client/Presentation | Normalized error rejects command; controls/dialog retain actionable UI |
| Alarm arrives late | Expected runtime condition | Derivation reconciles from epoch anchors and may cross several boundaries |

## Tests

| Area | Primary proof |
| --- | --- |
| Snapshot immutability, states, anchors, late derivation and Reward pauses | `domain/Session.test.ts` |
| Application persistence and missing/second-active failures | `application/sessionUseCases.test.ts` |
| Database restoration, one-active invariant, legacy pause and corruption | `infrastructure/DexieSessionRepository.test.ts` |
| Projection hydration and event race | `presentation/ActiveSessionStore.test.ts` |
| Runtime projection reconstruction | `presentation/parseSessionProjection.test.ts` |
| Countdown derivation | `presentation/sessionCountdown.test.ts` |
| Controls and Reward-pause restriction | `presentation/SessionControls.test.tsx` |
| Boundary observation and active view | `presentation/didCrossPhaseBoundary.test.ts`, `ActiveSessionView.test.tsx` |
| Reward transition detection, rolls/rerolls/reduced motion/failure | `presentation/rewardTransitions.test.ts`, `RewardResultDialog.test.tsx` |
| Background authority, messages, alarms and command idempotency | `src/app/background/createSessionCoordinator.test.ts` |
| Assembled execution/restoration | `tests/e2e/workflowExecution.spec.ts`, `sessionRestoration.spec.ts` |

Run focused tests with:

```bash
pnpm vitest run src/features/session src/app/background
```

## Change Impact Checklist

When changing Session behavior:

1. Update the discriminated union, constructor/restoration and every exhaustive
   state branch together.
2. Preserve immutable Workflow snapshot semantics and update its copy/mapping
   paths when Workflow execution configuration changes.
3. Decide whether the new fact is authoritative Domain state, persisted fact,
   derived display or transient ritual state.
4. Use epoch anchors; never add a decrementing authoritative timer.
5. Update Domain transition tests before Application/coordinator behavior.
6. Update record mapping and migration compatibility for persisted fields.
7. Update runtime projection parsing, message response expectations and
   per-context presentation handling.
8. Check alarm scheduling/clearing and worker-start reconciliation.
9. Distinguish non-final authoritative Reward pauses from final Presentation
   completion behavior.
10. Update this reference, state/messaging/persistence docs and affected flow
    documents.

Related decisions:

- [ADR-0003](../../adr/ADR-0003-workflow-aggregate-session-snapshot.md)
- [ADR-0004](../../adr/ADR-0004-authoritative-session-execution.md)
