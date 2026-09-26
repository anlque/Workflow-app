import { describe, expect, test } from 'vitest';

import {
  continueRewardSession,
  createSession,
  deriveSessionState,
  rollSessionReward,
} from '@/features/session';
import { createWorkflow } from '@/features/workflow';

import { completionCue } from './completionCue';

function workflow(rewarded = false) {
  return createWorkflow({
    id: rewarded ? 'rewarded' : 'ordinary',
    name: 'Deep work',
    phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
    ...(rewarded
      ? {
          rewardDice: {
            frequency: 1,
            sides: [
              { icon: '☕', title: 'Tea' },
              { icon: '🌿', title: 'Fresh air' },
            ],
          },
        }
      : {}),
  });
}

describe('completionCue', () => {
  test('classifies a newly completed ordinary Session', () => {
    const initial = createSession('session-1', workflow(), 1_000);
    const completed = deriveSessionState(initial, 3_000);

    expect(completionCue(initial, completed)).toBe('complete');
    expect(completionCue(completed, completed)).toBeNull();
  });

  test('uses the Reward cue only when entering the final opportunity', () => {
    const initial = createSession('session-1', workflow(true), 1_000);
    const completed = deriveSessionState(initial, 3_000);

    expect(completionCue(initial, completed)).toBe('reward');
    expect(completionCue(completed, completed)).toBeNull();
    expect(
      completionCue(
        completed,
        rollSessionReward(completed, () => 0, 'roll-1'),
      ),
    ).toBeNull();
    expect(completionCue(null, completed)).toBeNull();
  });

  test('ignores unrelated Session changes', () => {
    const initial = createSession('session-1', workflow(), 1_000);
    const another = deriveSessionState(
      createSession('session-2', workflow(), 1_000),
      3_000,
    );

    expect(completionCue(null, initial)).toBeNull();
    expect(completionCue(initial, another)).toBeNull();
  });

  test('waits for a final Bonus deadline before classifying completion', () => {
    const rewarded = createWorkflow({
      id: 'final-bonus-cue',
      name: 'Final Bonus cue',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'a',
            title: 'A',
            bonusPhase: {
              name: 'Bonus',
              durationSeconds: 30,
              environment: {},
            },
          },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const rewardPaused = deriveSessionState(
      createSession('final-bonus-cue-session', rewarded, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(rewardPaused, () => 0),
      4_000,
      'continue-cue',
    );
    const completed = deriveSessionState(bonus, 34_000);

    expect(completionCue(rewardPaused, bonus)).toBeNull();
    expect(completionCue(bonus, completed)).toBe('complete');
    expect(completionCue(completed, completed)).toBeNull();
    expect(completionCue(null, completed)).toBeNull();
  });
});
