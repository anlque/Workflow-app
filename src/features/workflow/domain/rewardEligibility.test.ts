import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from './createWorkflow';
import { eligibleDiceSides } from './eligibleDiceSides';
import { rewardOpportunityPhaseIndexes } from './rewardOpportunityPhaseIndexes';
import { rollReward } from './rollReward';

const phases = [
  { type: 'focus' as const, durationSeconds: 60, environment: {} },
  { type: 'break' as const, durationSeconds: 60, environment: {} },
  { type: 'focus' as const, durationSeconds: 60, environment: {} },
  { type: 'break' as const, durationSeconds: 60, environment: {} },
  { type: 'focus' as const, durationSeconds: 60, environment: {} },
];

function workflow(
  schedule:
    | { type: 'custom'; phaseIndexes: readonly number[] }
    | {
        type: 'frequency';
        triggerPhaseType: 'focus' | 'break';
        frequency: number;
      },
  sides = [
    { icon: 'a', title: 'Any', availability: 'any' as const, weight: 1 },
    { icon: 'e', title: 'Early', availability: 'early' as const, weight: 3 },
    { icon: 'l', title: 'Late', availability: 'late' as const, weight: 6 },
  ],
) {
  return createWorkflow({
    id: 'workflow-1',
    name: 'Focus',
    phases,
    rewardDice: { schedule, sides },
  });
}

describe('Reward Side eligibility', () => {
  test('derives actual opportunity Phase indexes for frequency and custom schedules', () => {
    expect(
      rewardOpportunityPhaseIndexes(
        workflow({
          type: 'frequency',
          triggerPhaseType: 'focus',
          frequency: 2,
        }),
      ),
    ).toEqual([2]);
    expect(
      rewardOpportunityPhaseIndexes(
        workflow({ type: 'custom', phaseIndexes: [1, 3, 4] }),
      ),
    ).toEqual([1, 3, 4]);
  });

  test('splits even opportunities into early and late halves', () => {
    const value = workflow({ type: 'custom', phaseIndexes: [0, 1, 2, 3] });
    expect(eligibleDiceSides(value, 1).map(({ title }) => title)).toEqual([
      'Any',
      'Early',
    ]);
    expect(eligibleDiceSides(value, 2).map(({ title }) => title)).toEqual([
      'Any',
      'Late',
    ]);
  });

  test('includes the odd middle opportunity in both halves', () => {
    const value = workflow({ type: 'custom', phaseIndexes: [0, 2, 4] });
    expect(eligibleDiceSides(value, 2).map(({ title }) => title)).toEqual([
      'Any',
      'Early',
      'Late',
    ]);
  });

  test.each([1, 2, 3, 4, 5])(
    'partitions %s opportunities around the mathematical middle',
    (count) => {
      const value = workflow({
        type: 'custom',
        phaseIndexes: Array.from({ length: count }, (_, index) => index),
      });
      for (let index = 0; index < count; index += 1) {
        const availability = eligibleDiceSides(value, index).map(
          (side) => side.availability,
        );
        expect(availability).toContain('any');
        expect(availability.includes('early')).toBe(index * 2 <= count - 1);
        expect(availability.includes('late')).toBe(index * 2 >= count - 1);
      }
    },
  );

  test.each([
    {
      schedule: { type: 'custom' as const, phaseIndexes: [0, 1] },
      availability: 'early' as const,
      opportunity: 2,
    },
    {
      schedule: {
        type: 'frequency' as const,
        triggerPhaseType: 'focus' as const,
        frequency: 1,
      },
      availability: 'late' as const,
      opportunity: 1,
    },
  ])(
    'rejects $schedule.type opportunity $opportunity without an eligible Side',
    ({ schedule, availability, opportunity }) => {
      expect(() =>
        workflow(schedule, [
          { icon: 'a', title: 'One', availability, weight: 1 },
          { icon: 'b', title: 'Two', availability, weight: 1 },
        ]),
      ).toThrow(
        `Reward opportunity ${String(opportunity)} must have at least one eligible Dice Side.`,
      );
    },
  );

  test('filters and renormalizes weights before rolling', () => {
    const value = workflow({ type: 'custom', phaseIndexes: [0, 1] });
    expect(rollReward(value, 1, () => 0.13).title).toBe('Any');
    expect(rollReward(value, 1, () => 0.15).title).toBe('Late');
  });

  test('rejects a non-opportunity Phase without consuming randomness', () => {
    const value = workflow({ type: 'custom', phaseIndexes: [1] });
    const random = vi.fn(() => 0);

    expect(() => rollReward(value, 0, random)).toThrow(
      'Reward can only be rolled for a configured opportunity.',
    );
    expect(random).not.toHaveBeenCalled();
  });
});
