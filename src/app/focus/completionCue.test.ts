import { describe, expect, test } from 'vitest';

import {
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
});
