# Phase Transition Flow

## Trigger

A Running Phase reaches its persisted `phaseEndsAt`. Chrome fires the named
Session alarm, or a later hydration/command reads the Session after the deadline
and reconciles it from wall-clock time.

## Preconditions

- A valid Running or Transitioning Session is persisted.
- Its immutable snapshot contains the current Phase and timing anchors.
- The background coordinator has registered the alarm listener.

The JavaScript process and countdown interval do not need to stay alive. The
deadline, not callback frequency, determines progress.

## Sequence

1. [`ChromeAlarmScheduler`](../../../src/platform/alarms/ChromeAlarmScheduler.ts)
   forwards the fired alarm name to the background coordinator. Other alarm
   names are ignored.
2. [`createSessionCoordinator`](../../../src/app/background/createSessionCoordinator.ts)
   loads the active Session. It advances only Running or Transitioning values.
3. [`advanceSessionUseCase`](../../../src/features/session/application/advanceSessionUseCase.ts)
   loads the requested Session and calls `deriveSessionState(session, now)` with
   the injected Clock.
4. [`deriveSessionState`](../../../src/features/session/domain/deriveSessionState.ts)
   moves an elapsed Running Phase to Transitioning with
   `transitionEndsAt = phaseEndsAt + 1000`.
5. If `now` is still before that anchor, derivation returns Transitioning. The
   use case saves it, then the coordinator publishes it and schedules the same
   alarm name for `transitionEndsAt`.
6. Focus Presentation observes the authoritative boundary once. It plays the
   synthesized bell, stops/fades ambient audio over one second, hides Session
   controls and applies the lighter blur/opacity treatment to the complete timer
   card. Countdown displays `00:00`.
7. At or after `transitionEndsAt`, derivation selects one outcome:
   - no next Phase → Completed at the scheduled transition end;
   - eligible Reward before a next Phase → Reward-paused on that next Phase with
     its full duration remaining;
   - otherwise → Running next Phase starting at `transitionEndsAt`.
8. The derivation loop continues while `now` is later than more scheduled
   deadlines. A late wake-up can therefore cross several ordinary Phases without
   extending them or depending on repeated alarms. It stops when it reaches a
   current Running/Transitioning anchor, a Reward pause or completion.
9. The resulting Session is saved once, published and used to schedule the next
   Running/Transitioning anchor; Paused/Completed clears the named alarm.
10. Connected documents replace their projections. Focus starts the next
    Environment audio with a one-second fade when status returns to Running.

The same Domain reconciliation is used by `getActiveSessionUseCase()` during
background initialization and document hydration, so a delayed or suspended
worker does not create a separate transition algorithm.

## Authoritative Changes

- `status`, `currentPhaseIndex` and the next state-specific timing anchors change
  in the Session record.
- Scheduled boundaries remain based on the previous persisted anchors, not on
  the late callback time.
- The Workflow snapshot, source Workflow and Asset records do not change.
- Bell, blur, countdown text and audio ramps are presentation effects only.

## Messages

No surface command is required. After persistence the coordinator broadcasts
`session/changed`. Documents may also receive the same reconciled projection as
the result of `session/get-active` during hydration.

## Persistence

Every changed derived state is stored before publication. A late derivation may
skip intermediate persisted projections and save only the current correct state.
The browser alarm stores the next wake-up request, while the Session record owns
the deadlines needed to reconstruct truth.

## Failure and Recovery

| Failure                                  | Observable result                                                         | Recovery                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Alarm fires late or worker was suspended | UI may jump across elapsed Phases                                         | Expected: the derivation loop reconciles from persisted anchors                                     |
| Alarm is missing                         | No timely event while documents are idle                                  | Background initialization or `session/get-active` reconciles; inspect alarm composition if repeated |
| Record is invalid                        | Reconciliation rejects at mapper/Domain boundary                          | Diagnose the stored record/version; do not cast or delete data by default                           |
| Publication is missed                    | One document keeps an old projection                                      | Reopen/reconnect it to hydrate from `session/get-active`                                            |
| Audio is locked                          | Timing still advances; bell/ambient sound is absent                       | Use the focus `Enable sounds` action from a user gesture                                            |
| Several boundaries elapsed               | Presentation emits at most one observed bell for the collapsed projection | This is current projection behavior, not replay of every missed cue                                 |

## Proof in Tests

- transition window and late multi-deadline reconciliation:
  `src/features/session/domain/Session.test.ts`.
- Application persistence after derivation:
  `src/features/session/application/sessionUseCases.test.ts`.
- alarm scheduling/publication:
  `src/app/background/createSessionCoordinator.test.ts`.
- one observed bell and transition UI:
  `src/features/session/presentation/didCrossPhaseBoundary.test.ts` and
  `ActiveSessionView.test.tsx`.
- audio fade and synthesized bell:
  `src/app/focus/FocusEnvironment.test.tsx`, `createUiSoundPlayer.test.ts`.
- assembled transition: `tests/e2e/workflowExecution.spec.ts`.

Run focused proof with:

```bash
pnpm vitest run src/app/background src/features/session src/app/focus
```

## Related Concepts and ADRs

- [Product Specification](../../concepts/01_PRODUCT_SPECIFICATION.md)
- [Domain Model](../../concepts/02_DOMAIN_MODEL.md)
- [ADR-0003: Workflow Aggregate and Session Snapshot](../../adr/ADR-0003-workflow-aggregate-session-snapshot.md)
- [ADR-0004: Authoritative Session Execution](../../adr/ADR-0004-authoritative-session-execution.md)
- [Runtime Model](../../onboarding/03_RUNTIME_MODEL.md)
- [Session Feature](../features/SESSION.md)
