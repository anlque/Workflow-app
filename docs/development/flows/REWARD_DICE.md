# Reward Dice Flow

## Trigger

A Phase selected by the Workflow's Reward schedule finishes. A frequency
schedule uses the configured Phase type and matching ordinal; a custom schedule
uses explicit zero-based Phase indexes.
Eligibility is calculated from the immutable Workflow snapshot and the completed
Phase index; it is not a timer or random event.

## Preconditions

- The Session snapshot contains a valid Reward Dice with at least two sides.
- Each configured opportunity has at least one eligible Side. Domain code
  derives its position from the canonical schedule; `any` is always eligible,
  even halves use early then late, and an odd middle belongs to both.
- The completed Phase is eligible according to
  [`isRewardDueAfterPhase()`](../../../src/features/workflow/domain/isRewardDueAfterPhase.ts).
- Reward interaction is composed in Focus and Side Panel from the same
  authoritative commands; Focus additionally owns Dice sound.
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
4. The persisted ritual contains opportunity identity, completed Phase,
   rerolls, optional result and a `phase` continuation target.
5. [`ActiveSessionView`](../../../src/features/session/presentation/ActiveSessionView.tsx)
   renders `RewardResultDialog` directly from that projection on either Session
   surface; remount does not create or select another opportunity.

### Final Reward

1. After the last Phase transition, an eligible Reward creates the same
   authoritative Reward pause with a `complete` continuation target.
2. Any newly opened Session surface reconstructs the dialog from that state.
3. Focus plays the distinct reward-unlocked cue. The ordinary completion cue is
   delayed until Continue persists the Completed transition.

### Roll, Reroll and Continue

1. The dialog opens in `ready`; no result is chosen automatically.
2. Clicking **Roll dice** sends `session/roll-reward`. The serialized background
   command invokes Domain selection with injected randomness, persists the
   result and broadcasts the updated Session. Presentation enters `mixing` and
   hides the authoritative result while the cube moves.
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
7. For a final Reward, Continue sends the same authoritative command, follows
   the stored `complete` target and only then reveals Completed state.

The selected Dice Side and reroll history are Session Domain state. They are
stored and broadcast as part of the authoritative projection.

## Authoritative Changes

- Non-final eligibility changes persisted Session state to Reward-paused; Continue
  changes it back to Running with new start/end anchors.
- Final eligibility creates a Reward pause with a `complete` continuation target.
- Animation stage, sound and dialog focus are local
  Presentation state.
- Reward Dice configuration remains part of the immutable Session snapshot.

## Messages

| Message                              | When                                 | Effect                                                 |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------ |
| `session/changed`                    | Reward pause/completion is persisted | Focus detects and presents the opportunity             |
| `session/continue-reward`            | Continue after a non-final result    | Requests the only valid transition out of Reward pause |
| command response + `session/changed` | Continue succeeds                    | Validates and replaces projections with Running state  |

Messages do not carry caller-selected outcomes. `session/roll-reward` and
`session/reroll-reward` ask the serialized background coordinator to select and
persist the outcome using injected randomness; `session/changed` returns the
complete authoritative projection.

## Persistence

Session record v5 persists `pauseReason: 'reward'`, the opportunity identity,
completed Phase index, selected Side index, rerolls used, acknowledgment and
the `phase | complete` continuation target. Versions 1–4 remain readable and
restore their historical state without inventing a selected result.

## Failure and Recovery

| Failure                               | Observable result                                                  | Recovery                                                             |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Audio context remains locked          | Dice/reward/completion sounds are silent; Session flow still works | Click `Enable sounds` or another focus control that unlocks audio    |
| Continue command fails                | Dialog stays open and shows an error                               | Retry after diagnosing runtime/background/storage failure            |
| Focus reloads during Reward           | Dialog hydrates the same result and reroll allowance                | Retry only a failed command; remount does not roll                    |
| Focus misses final transition         | Final Reward remains persisted and actionable                       | Open either Session surface                                           |
| Invalid random value                  | Workflow Domain throws before a result                             | Fix the injected random source; production uses `Math.random()`      |
| UI sound synthesis fails              | Sound player swallows the cue failure                              | Interaction and Session authority remain unaffected                  |

## Proof in Tests

- frequency and custom eligibility: `src/features/workflow/domain/isRewardDueAfterPhase.test.ts`.
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
