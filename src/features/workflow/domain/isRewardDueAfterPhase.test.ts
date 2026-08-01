import { describe, expect, test } from 'vitest';

import { createWorkflow } from './createWorkflow';
import { isRewardDueAfterPhase } from './isRewardDueAfterPhase';

function workflow(frequency?: number) {
  return createWorkflow({
    id: 'workflow-1',
    name: 'Deep work',
    phases: [
      { type: 'focus', durationSeconds: 10, environment: {} },
      { type: 'break', durationSeconds: 5, environment: {} },
      { type: 'focus', durationSeconds: 10, environment: {} },
      { type: 'focus', durationSeconds: 10, environment: {} },
    ],
    ...(frequency === undefined
      ? {}
      : {
          rewardDice: {
            frequency,
            sides: [
              { icon: 'tea', title: 'Tea' },
              { icon: 'walk', title: 'Walk' },
            ],
          },
        }),
  });
}

describe('isRewardDueAfterPhase', () => {
  test.each([
    ['no Reward Dice', workflow(), 0, false],
    ['break Phase', workflow(1), 1, false],
    ['first focus at frequency two', workflow(2), 0, false],
    ['second focus at frequency two', workflow(2), 2, true],
    ['third focus at frequency two', workflow(2), 3, false],
    ['negative Phase index', workflow(1), -1, false],
    ['out-of-range Phase index', workflow(1), 4, false],
  ] as const)(
    'returns the expected eligibility for %s',
    (_case, value, completedPhaseIndex, expected) => {
      expect(isRewardDueAfterPhase(value, completedPhaseIndex)).toBe(expected);
    },
  );
});
