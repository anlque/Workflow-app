import { describe, expect, test } from 'vitest';

import { createSession, deriveSessionState } from '@/features/session';
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

  test('uses the Reward cue for an eligible final completion', () => {
    const initial = createSession('session-1', workflow(true), 1_000);
    const completed = deriveSessionState(initial, 3_000);

    expect(completionCue(initial, completed)).toBe('reward');
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
