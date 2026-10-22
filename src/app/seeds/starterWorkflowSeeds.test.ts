import { describe, expect, test } from 'vitest';

import {
  createWorkflow,
  type CreateDetailedWorkflowInput,
} from '@/features/workflow';

import { starterAssetSeeds } from './starterAssetSeeds';
import { starterWorkflowSeeds } from './starterWorkflowSeeds';

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(expectDeeplyFrozen);
}

function roleReferences(input: CreateDetailedWorkflowInput) {
  const environments = [
    ...input.phases.map(({ environment }) => environment),
    ...(input.rewardDice?.sides.flatMap(({ bonusPhase }) =>
      bonusPhase === undefined ? [] : [bonusPhase.environment],
    ) ?? []),
  ];
  return environments.flatMap((environment) =>
    [environment.backgroundAsset, environment.audioAsset].filter(
      (reference) => reference !== undefined,
    ),
  );
}

describe('starterWorkflowSeeds', () => {
  test('defines the three exact editable starter journeys', () => {
    expect(starterWorkflowSeeds.map(({ id, name }) => ({ id, name }))).toEqual([
      {
        id: 'locusora:seed:v2:workflow:quick-focus',
        name: 'Quick Focus',
      },
      {
        id: 'locusora:seed:v2:workflow:balanced-flow',
        name: 'Balanced Flow',
      },
      {
        id: 'locusora:seed:v2:workflow:reward-journey',
        name: 'Reward Journey',
      },
    ]);
    expect(
      starterWorkflowSeeds.map(({ phases }) =>
        phases.map(({ name, type, durationSeconds }) => ({
          name,
          type,
          durationSeconds,
        })),
      ),
    ).toEqual([
      [{ name: 'Quick focus', type: 'focus', durationSeconds: 600 }],
      [
        { name: 'Settle in', type: 'focus', durationSeconds: 1_500 },
        { name: 'Short break', type: 'break', durationSeconds: 300 },
        { name: 'Deep work', type: 'focus', durationSeconds: 1_500 },
      ],
      [
        { name: 'Focused effort', type: 'focus', durationSeconds: 1_200 },
        { name: 'Reset', type: 'break', durationSeconds: 300 },
        { name: 'Finish strong', type: 'focus', durationSeconds: 1_200 },
      ],
    ]);
    expect(
      starterWorkflowSeeds.map((input) => createWorkflow(input).mode),
    ).toEqual(['detailed', 'detailed', 'detailed']);
  });

  test('uses only existing Role references with the matching Asset kind', () => {
    const roles = new Map(
      starterAssetSeeds.map(({ role, kind }) => [role, kind] as const),
    );

    for (const workflow of starterWorkflowSeeds) {
      for (const reference of roleReferences(workflow)) {
        expect(reference.type).toBe('role');
        if (reference.type !== 'role') continue;
        expect(roles.has(reference.role)).toBe(true);
      }
      for (const phase of workflow.phases) {
        if (phase.environment.backgroundAsset?.type === 'role') {
          expect(roles.get(phase.environment.backgroundAsset.role)).toBe(
            'image',
          );
        }
        if (phase.environment.audioAsset?.type === 'role') {
          expect(roles.get(phase.environment.audioAsset.role)).toBe('audio');
        }
      }
      for (const side of workflow.rewardDice?.sides ?? []) {
        const environment = side.bonusPhase?.environment;
        if (environment?.backgroundAsset?.type === 'role') {
          expect(roles.get(environment.backgroundAsset.role)).toBe('image');
        }
        if (environment?.audioAsset?.type === 'role') {
          expect(roles.get(environment.audioAsset.role)).toBe('audio');
        }
      }
    }
  });

  test('configures Reward Journey with equal any-side Bonus rewards', () => {
    const rewardJourney = starterWorkflowSeeds[2];
    if (rewardJourney === undefined) throw new Error('Reward Journey missing.');
    expect(rewardJourney.rewardDice).toEqual({
      schedule: {
        type: 'frequency',
        triggerPhaseType: 'focus',
        frequency: 1,
      },
      rerolls: 1,
      sides: [
        {
          icon: '☕',
          title: 'Tea ritual',
          description: 'Step away and make a warm drink.',
          availability: 'any',
          bonusPhase: {
            name: 'Tea ritual',
            durationSeconds: 300,
            environment: {
              backgroundAsset: {
                type: 'role',
                role: 'Starter background — Rainlit Window',
              },
              audioAsset: {
                type: 'role',
                role: 'Starter ambience — Cozy Bedroom Rain',
              },
            },
          },
        },
        {
          icon: '🧘',
          title: 'Stretch reset',
          description: 'Move, breathe, and reset.',
          availability: 'any',
          bonusPhase: {
            name: 'Stretch reset',
            durationSeconds: 180,
            environment: {
              backgroundAsset: {
                type: 'role',
                role: 'Starter background — Mosswood',
              },
              audioAsset: {
                type: 'role',
                role: 'Starter ambience — Healing Bowl',
              },
            },
          },
        },
      ],
    });
    const created = createWorkflow(rewardJourney);
    expect(
      created.rewardDice?.sides.map(({ probability }) => probability),
    ).toEqual([0.5, 0.5]);
  });

  test('contains valid deeply immutable CreateWorkflowInput definitions', () => {
    expect(starterWorkflowSeeds).toHaveLength(3);
    starterWorkflowSeeds.forEach((definition) => {
      expect(() => createWorkflow(definition)).not.toThrow();
      expectDeeplyFrozen(definition);
    });
    expectDeeplyFrozen(starterWorkflowSeeds);
  });
});
