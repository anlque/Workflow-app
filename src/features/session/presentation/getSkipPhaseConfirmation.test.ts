import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  rollSessionReward,
} from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { getSkipPhaseConfirmation } from './getSkipPhaseConfirmation';

function ordinary(options: { reward: boolean; final: boolean }) {
  const phases = options.final
    ? [{ type: 'focus' as const, durationSeconds: 10, environment: {} }]
    : [
        { type: 'focus' as const, durationSeconds: 10, environment: {} },
        { type: 'break' as const, durationSeconds: 5, environment: {} },
      ];
  return createSession(
    'session-1',
    createWorkflow({
      id: `workflow-${String(options.reward)}-${String(options.final)}`,
      name: 'Work',
      phases,
      ...(options.reward
        ? {
            rewardDice: {
              frequency: 1,
              sides: [
                { icon: 'a', title: 'A' },
                { icon: 'b', title: 'B' },
              ],
            },
          }
        : {}),
    }),
    1_000,
  );
}

function bonus(final: boolean) {
  const phases = final
    ? [{ type: 'focus' as const, durationSeconds: 10, environment: {} }]
    : [
        { type: 'focus' as const, durationSeconds: 10, environment: {} },
        { type: 'break' as const, durationSeconds: 5, environment: {} },
      ];
  const workflow = createWorkflow({
    id: `bonus-${String(final)}`,
    name: 'Bonus',
    phases,
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
  const reward = deriveSessionState(
    createSession('session-1', workflow, 1_000),
    12_000,
  );
  return continueRewardSession(
    rollSessionReward(reward, () => 0, 'roll'),
    12_000,
    'continue',
  );
}

describe('getSkipPhaseConfirmation', () => {
  test('skips intermediate non-Reward ordinary and Bonus phases immediately', () => {
    expect(
      getSkipPhaseConfirmation(ordinary({ reward: false, final: false })),
    ).toBeNull();
    expect(getSkipPhaseConfirmation(bonus(false))).toBeNull();
  });

  test('warns when an intermediate ordinary phase would lose a Reward', () => {
    expect(
      getSkipPhaseConfirmation(ordinary({ reward: true, final: false })),
    ).toEqual({
      title: 'Skip this phase?',
      body: 'Skipped phases do not unlock rewards. Your session will continue with the next phase.',
    });
  });

  test.each([
    [false, 'This will finish the session.'],
    [
      true,
      'This will finish the session. Skipped phases do not unlock rewards.',
    ],
  ] as const)(
    'warns before skipping a final ordinary phase',
    (reward, body) => {
      expect(
        getSkipPhaseConfirmation(ordinary({ reward, final: true })),
      ).toEqual({ title: 'Skip final phase?', body });
    },
  );

  test('warns before skipping a final Bonus phase', () => {
    expect(getSkipPhaseConfirmation(bonus(true))).toEqual({
      title: 'Skip Bonus Phase?',
      body: 'This will finish the session.',
    });
  });
});
