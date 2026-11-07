import { describe, expect, test } from 'vitest';

import { formatRewardWeightPresentation } from './rewardWeightPresentation';

describe('formatRewardWeightPresentation', () => {
  test('normalizes valid relative weights into chances totaling 100%', () => {
    expect(formatRewardWeightPresentation(['0.1', '0.2', '0.3'])).toEqual({
      summary: 'Total chance 100%',
      sides: [
        'Weight 0.1 · 16.7% chance',
        'Weight 0.2 · 33.3% chance',
        'Weight 0.3 · 50% chance',
      ],
    });
  });

  test('gives all-empty weights equal chances', () => {
    expect(formatRewardWeightPresentation(['', ''])).toEqual({
      summary: 'Total chance 100%',
      sides: ['Equal weight · 50% chance', 'Equal weight · 50% chance'],
    });
  });

  test('distributes display rounding so normalized chances still total 100%', () => {
    const result = formatRewardWeightPresentation(['', '', '']);

    expect(result.summary).toBe('Total chance 100%');
    expect(result.sides).toEqual([
      'Equal weight · 33.4% chance',
      'Equal weight · 33.3% chance',
      'Equal weight · 33.3% chance',
    ]);
  });

  test.each([
    [
      ['1', ''],
      ['Weight 1', 'Weight not set'],
    ],
    [
      ['0', '1'],
      ['Weight 0', 'Weight 1'],
    ],
    [
      ['nope', '1'],
      ['Weight nope', 'Weight 1'],
    ],
    [
      ['1e308', '8e307'],
      ['Weight 1e308', 'Weight 8e307'],
    ],
  ])(
    'does not claim probabilities for an incomplete or invalid draft',
    (weights, sides) => {
      expect(formatRewardWeightPresentation(weights)).toEqual({
        summary: null,
        sides,
      });
    },
  );
});
