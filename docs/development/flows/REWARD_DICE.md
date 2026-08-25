# Reward Dice Flow

## Trigger

A Phase of the Workflow-configured `triggerPhaseType` finishes, and its ordinal
among matching completed Phases is divisible by Reward Dice `frequency`.
Eligibility is calculated from the immutable Workflow snapshot and the completed
Phase index; it is not a timer or random event.

## Preconditions

- The Session snapshot contains a valid Reward Dice with at least two sides.
- The completed Phase is eligible according to
  [`isRewardDueAfterPhase()`](../../../src/features/workflow/domain/isRewardDueAfterPhase.ts).
- Reward interaction is composed in the focus view. Other surfaces can project
  Reward-paused state but do not roll the Dice.
- UI audio must have been unlocked by a user gesture for synthesized cues to be
  audible.

## Sequence

### Non-final Reward

1. [`deriveSessionState()`](../../../src/features/session/domain/deriveSessionState.ts)
   finishes the one-second Phase transition and discovers both a next Phase and
   an eligible Reward.
2. It stores the Session as Paused on that next Phase with
   `pauseReason: 'reward'` and the next Phase's full duration remaining. No next
   Phase time elapses while the Reward is pending.
3. Background persists and broadcasts this authoritative state and clears the
   Session alarm.
4. [`rewardOpportunityForSessionTransition()`](../../../src/features/session/presentation/rewardTransitions.ts)
   recognizes a new Reward pause. Hydrating focus directly into a pending
   Reward pause also restores the dialog.
5. [`ActiveSessionView`](../../../src/features/session/presentation/ActiveSessionView.tsx)
   mounts `RewardResultDialog`; side panel instead shows `Reward pending — open
focus view`.

### Final Reward

1. After the last Phase transition, Domain state becomes Completed regardless of
   reward eligibility; there is no next Phase to pause.
2. Presentation compares the previous and current projections. If it observed a
   non-terminal → Completed transition and the final Phase is eligible, it shows
   the same Reward dialog over the terminal card.
3. One second after that observed completion, focus plays the distinct
   reward-unlocked cue. It does not play the ordinary completion cue yet.

### Roll, Reroll and Continue

1. The dialog opens in `ready`; no result is chosen automatically.
2. Clicking **Roll dice** calls `rollReward(dice, random)`, stores the selected
   side locally and enters `mixing`. The result is hidden while the cube moves.
3. Focus starts the synthesized Dice sound for the same duration: 2.5 seconds,
   or 0.6 seconds when reduced motion is active.
4. When the duration ends, the cube and selected side enter `result`.
5. If configured rerolls remain, **Roll again · N left** repeats the same random,
   animation and sound sequence and replaces the previous result. `rerolls` is
   the number of additional rolls, from 0 through 3; the initial roll does not
   consume it.
6. **Continue** accepts the last visible result. For a non-final Reward it sends
   `session/continue-reward`; Domain resumes the waiting Phase from the current
   wall clock with its stored full duration, then background saves, broadcasts
   and schedules its deadline.
7. For a final Reward, Continue only dismisses the Presentation dialog and
   reveals the already-Completed state. It schedules the ordinary
   session-complete cue one second later.

The selected Dice Side and reroll history are not Session Domain state. They are
not stored, broadcast or used by later business behavior.

## Authoritative Changes

- Non-final eligibility changes persisted Session state to Reward-paused; Continue
  changes it back to Running with new start/end anchors.
- Final eligibility does not alter the Completed record.
- Random result, animation stage, used rerolls and dialog visibility are local
  Presentation state.
- Reward Dice configuration remains part of the immutable Session snapshot.

## Messages

| Message                              | When                                 | Effect                                                 |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------ |
| `session/changed`                    | Reward pause/completion is persisted | Focus detects and presents the opportunity             |
| `session/continue-reward`            | Continue after a non-final result    | Requests the only valid transition out of Reward pause |
| command response + `session/changed` | Continue succeeds                    | Validates and replaces projections with Running state  |

No message contains the selected side or reroll count.

## Persistence

Persisted Session data contains `pauseReason: 'reward'`, remaining next-Phase
time and the snapshotted Reward Dice configuration. It does not contain a
pending-final-Reward flag, selected side, acknowledgment or used-reroll count.

Current implementation limitations:

- used rerolls live only in `RewardResultDialog` React state. Closing/reloading
  the focus document during the same non-final Reward remounts the dialog and
  resets the allowance, although the product rule intends the allowance to reset
  only for each new Reward;
- a final Reward is detected only from an observed projection transition to
  Completed. Hydrating after that transition cannot reconstruct the unobserved
  final dialog, so the Reward may be missed.

Fixing either limitation requires an explicit Domain/persistence decision about
Reward occurrence, result and acknowledgment; a component-only workaround would
create inconsistent replay behavior.

## Failure and Recovery

| Failure                               | Observable result                                                  | Recovery                                                             |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Audio context remains locked          | Dice/reward/completion sounds are silent; Session flow still works | Click `Enable sounds` or another focus control that unlocks audio    |
| Continue command fails                | Dialog stays open and shows an error                               | Retry after diagnosing runtime/background/storage failure            |
| Focus reloads during non-final Reward | Dialog restores but reroll usage resets                            | Known limitation; do not treat reload as a supported allowance reset |
| Focus misses final transition         | Completed card appears without final Reward                        | Known persistence limitation                                         |
| Invalid random value                  | Workflow Domain throws before a result                             | Fix the injected random source; production uses `Math.random()`      |
| UI sound synthesis fails              | Sound player swallows the cue failure                              | Interaction and Session authority remain unaffected                  |

## Proof in Tests

- eligibility by Phase type/frequency: `src/features/workflow/domain/isRewardDueAfterPhase.test.ts`.
- weighted selection and random bounds: `src/features/workflow/domain/rollReward.test.ts`.
- Reward pause/continue transitions: `src/features/session/domain/Session.test.ts`
  and `application/sessionUseCases.test.ts`.
- opportunity detection/restoration: `src/features/session/presentation/rewardTransitions.test.ts`.
- click-to-roll, durations and rerolls: `RewardResultDialog.test.tsx`.
- assembled dialog and final Continue behavior: `ActiveSessionView.test.tsx`.
- audio sequencing: `src/app/focus/createUiSoundPlayer.test.ts`,
  `completionCue.test.ts` and `useCompletionCue.test.tsx`.
- browser journey: `tests/e2e/workflowExecution.spec.ts`.

Run focused proof with:

```bash
pnpm vitest run src/features/workflow src/features/session src/app/focus
```

## Related Concepts and ADRs

- [Product Specification](../../concepts/01_PRODUCT_SPECIFICATION.md)
- [Domain Model](../../concepts/02_DOMAIN_MODEL.md)
- [ADR-0003: Workflow Aggregate and Session Snapshot](../../adr/ADR-0003-workflow-aggregate-session-snapshot.md)
- [ADR-0004: Authoritative Session Execution](../../adr/ADR-0004-authoritative-session-execution.md)
- [Workflow Feature](../features/WORKFLOW.md)
- [Session Feature](../features/SESSION.md)
