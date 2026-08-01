import { describe, expect, test } from 'vitest';

import { createWorkflow } from './createWorkflow';
import { rollReward } from './rollReward';

const rewardDice = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    {
      type: 'focus',
      durationSeconds: 1_500,
      environment: {},
    },
  ],
  rewardDice: {
    frequency: 1,
    sides: [
      { icon: 'tea', title: 'Tea', weight: 3 },
      { icon: 'walk', title: 'Walk', weight: 1 },
    ],
  },
}).rewardDice;

if (rewardDice === undefined) {
  throw new Error('Test fixture must contain Reward Dice.');
}

describe('rollReward', () => {
  test.each([
    [0, 'Tea'],
    [0.749_999, 'Tea'],
    [0.75, 'Walk'],
    [0.999_999, 'Walk'],
  ] as const)('maps random value %s to %s', (randomValue, expectedTitle) => {
    expect(rollReward(rewardDice, () => randomValue).title).toBe(expectedTitle);
  });

  test.each([-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects random value outside [0, 1): %s',
    (randomValue) => {
      expect(() => rollReward(rewardDice, () => randomValue)).toThrow(
        'Random source must return a finite number in [0, 1).',
      );
    },
  );
});
