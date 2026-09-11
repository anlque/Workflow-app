import { describe, expect, test } from 'vitest';

import { createWorkflow } from './createWorkflow';
import { WorkflowValidationError } from './WorkflowErrors';

const validPhase = {
  type: 'focus',
  durationSeconds: 1_500,
  environment: {
    backgroundColor: '#102030',
  },
} as const;

describe('createWorkflow', () => {
  test('creates a normalized deeply immutable Workflow', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: '  Deep work  ',
      phases: [validPhase],
    });

    expect(workflow.name).toBe('Deep work');
    expect(workflow.phases).toHaveLength(1);
    expect(Object.isFrozen(workflow)).toBe(true);
    expect(Object.isFrozen(workflow.phases)).toBe(true);
    expect(Object.isFrozen(workflow.phases[0])).toBe(true);
    expect(Object.isFrozen(workflow.phases[0].environment)).toBe(true);
  });

  test('creates direct and normalized Role Asset references', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [
        {
          ...validPhase,
          environment: {
            backgroundAsset: { type: 'direct', assetId: 'image-1' },
            audioAsset: { type: 'role', role: '  Fav\tFocus ' },
          },
        },
      ],
    });

    expect(workflow.phases[0].environment).toEqual({
      backgroundAsset: { type: 'direct', assetId: 'image-1' },
      audioAsset: { type: 'role', role: 'Fav Focus' },
    });
    expect(Object.isFrozen(workflow.phases[0].environment.audioAsset)).toBe(
      true,
    );
  });

  test('rejects an invalid Asset reference discriminator', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [
          {
            ...validPhase,
            environment: {
              audioAsset: { type: 'dynamic', role: 'focus' } as never,
            },
          },
        ],
      }),
    ).toThrow('Asset reference must be direct or role-based.');
  });

  test.each([
    { type: 'direct', assetId: 'asset-1', role: 'Backdrop' },
    { type: 'role', role: 'Backdrop', assetId: 'asset-1' },
  ])('rejects contradictory Asset reference %#', (audioAsset) => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [
          {
            ...validPhase,
            environment: { audioAsset: audioAsset as never },
          },
        ],
      }),
    ).toThrow('Asset reference must be direct or role-based.');
  });

  test.each(['', '   '])('rejects an empty Workflow name %j', (name) => {
    expect(() =>
      createWorkflow({ id: 'workflow-1', name, phases: [validPhase] }),
    ).toThrow('Workflow name must not be empty.');
  });

  test('rejects a Workflow without Phases', () => {
    expect(() =>
      createWorkflow({ id: 'workflow-1', name: 'Deep work', phases: [] }),
    ).toThrow('Workflow must contain at least one Phase.');
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid Phase duration %s',
    (durationSeconds) => {
      expect(() =>
        createWorkflow({
          id: 'workflow-1',
          name: 'Deep work',
          phases: [{ ...validPhase, durationSeconds }],
        }),
      ).toThrow('Phase duration must be a positive integer number of seconds.');
    },
  );

  test('rejects an unsupported Phase type at runtime', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [{ ...validPhase, type: 'long-break' }],
      }),
    ).toThrow('Phase type must be focus or break.');
  });

  test('creates Reward Dice with normalized custom weights', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [validPhase],
      rewardDice: {
        frequency: 2,
        sides: [
          { icon: 'tea', title: 'Tea', weight: 3 },
          { icon: 'walk', title: 'Walk', weight: 1 },
        ],
      },
    });

    expect(
      workflow.rewardDice?.sides.map(({ probability }) => probability),
    ).toEqual([0.75, 0.25]);
    expect(Object.isFrozen(workflow.rewardDice)).toBe(true);
    expect(Object.isFrozen(workflow.rewardDice?.sides)).toBe(true);
  });

  test('defaults legacy Reward Dice to focus phases', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [validPhase],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    expect(workflow.rewardDice?.schedule).toEqual({
      type: 'frequency',
      triggerPhaseType: 'focus',
      frequency: 1,
    });
    expect(workflow.rewardDice?.rerolls).toBe(0);
  });

  test('rejects a canonical frequency schedule without a trigger Phase type', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          schedule: { type: 'frequency', frequency: 1 } as never,
          sides: [
            { icon: 'tea', title: 'Tea' },
            { icon: 'walk', title: 'Walk' },
          ],
        },
      }),
    ).toThrow('Reward Dice trigger Phase type must be focus or break.');
  });

  test('rejects a malformed present schedule instead of using valid legacy fields', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          schedule: { type: 'sometimes' },
          triggerPhaseType: 'focus',
          frequency: 1,
          sides: [
            { icon: 'tea', title: 'Tea' },
            { icon: 'walk', title: 'Walk' },
          ],
        } as never,
      }),
    ).toThrow('Reward Dice schedule must be frequency or custom.');
  });

  test.each([null, 1, 'frequency', []])(
    'rejects non-object schedule %j with a Workflow validation error',
    (schedule) => {
      expect(() =>
        createWorkflow({
          id: 'workflow-1',
          name: 'Deep work',
          phases: [validPhase],
          rewardDice: {
            schedule,
            sides: [
              { icon: 'tea', title: 'Tea' },
              { icon: 'walk', title: 'Walk' },
            ],
          } as never,
        }),
      ).toThrow(WorkflowValidationError);
    },
  );

  test('does not use legacy fallback when schedule is an own undefined property', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          schedule: undefined,
          triggerPhaseType: 'focus',
          frequency: 1,
          sides: [
            { icon: 'tea', title: 'Tea' },
            { icon: 'walk', title: 'Walk' },
          ],
        } as never,
      }),
    ).toThrow(WorkflowValidationError);
  });

  test('rejects canonical schedule combined with top-level legacy timing fields', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          schedule: {
            type: 'frequency',
            triggerPhaseType: 'focus',
            frequency: 1,
          },
          triggerPhaseType: 'break',
          frequency: 2,
          sides: [
            { icon: 'tea', title: 'Tea' },
            { icon: 'walk', title: 'Walk' },
          ],
        } as never,
      }),
    ).toThrow(WorkflowValidationError);
  });

  test.each([
    {
      type: 'frequency',
      triggerPhaseType: 'focus',
      frequency: 1,
      extra: true,
    },
    { type: 'custom', phaseIndexes: [0], extra: true },
  ])('rejects schedule with extra own fields %#', (schedule) => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          schedule,
          sides: [
            { icon: 'tea', title: 'Tea' },
            { icon: 'walk', title: 'Walk' },
          ],
        } as never,
      }),
    ).toThrow(WorkflowValidationError);
  });

  test('creates a sorted immutable custom Reward schedule', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [validPhase, validPhase, validPhase, validPhase],
      rewardDice: {
        schedule: { type: 'custom', phaseIndexes: [3, 1] },
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    expect(workflow.rewardDice?.schedule).toEqual({
      type: 'custom',
      phaseIndexes: [1, 3],
    });
    expect(Object.isFrozen(workflow.rewardDice?.schedule)).toBe(true);
    expect(
      Object.isFrozen(
        workflow.rewardDice?.schedule.type === 'custom'
          ? workflow.rewardDice.schedule.phaseIndexes
          : undefined,
      ),
    ).toBe(true);
  });

  test.each([[[1, 1]], [[-1]], [[0.5]], [[4]]])(
    'rejects invalid custom Reward indexes %j',
    (phaseIndexes) => {
      expect(() =>
        createWorkflow({
          id: 'workflow-1',
          name: 'Deep work',
          phases: [validPhase, validPhase, validPhase, validPhase],
          rewardDice: {
            schedule: { type: 'custom', phaseIndexes },
            sides: [
              { icon: 'tea', title: 'Tea' },
              { icon: 'walk', title: 'Walk' },
            ],
          },
        }),
      ).toThrow(
        'Custom Reward phase indexes must be unique in-range integers.',
      );
    },
  );

  test.each([0, 1, 2, 3])('accepts %s Reward Dice rerolls', (rerolls) => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [validPhase],
      rewardDice: {
        frequency: 1,
        rerolls,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    expect(workflow.rewardDice?.rerolls).toBe(rerolls);
  });

  test.each([-1, 4, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid Reward Dice rerolls %s',
    (rerolls) => {
      expect(() =>
        createWorkflow({
          id: 'workflow-1',
          name: 'Deep work',
          phases: [validPhase],
          rewardDice: {
            frequency: 1,
            rerolls,
            sides: [
              { icon: 'tea', title: 'Tea' },
              { icon: 'walk', title: 'Walk' },
            ],
          },
        }),
      ).toThrow('Reward Dice rerolls must be an integer from 0 through 3.');
    },
  );

  test('creates Reward Dice triggered by break phases', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [validPhase],
      rewardDice: {
        triggerPhaseType: 'break',
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    expect(workflow.rewardDice?.schedule).toEqual({
      type: 'frequency',
      triggerPhaseType: 'break',
      frequency: 1,
    });
  });

  test('assigns equal probabilities when all custom weights are omitted', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [validPhase],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    expect(
      workflow.rewardDice?.sides.map(({ probability }) => probability),
    ).toEqual([0.5, 0.5]);
  });

  test('rejects Reward Dice with fewer than two sides', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          frequency: 1,
          sides: [{ icon: 'tea', title: 'Tea' }],
        },
      }),
    ).toThrow('Reward Dice must contain at least two sides.');
  });

  test.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid Reward Dice frequency %s',
    (frequency) => {
      expect(() =>
        createWorkflow({
          id: 'workflow-1',
          name: 'Deep work',
          phases: [validPhase],
          rewardDice: {
            frequency,
            sides: [
              { icon: 'tea', title: 'Tea' },
              { icon: 'walk', title: 'Walk' },
            ],
          },
        }),
      ).toThrow('Reward Dice frequency must be a positive integer.');
    },
  );

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid Reward Dice weight %s',
    (weight) => {
      expect(() =>
        createWorkflow({
          id: 'workflow-1',
          name: 'Deep work',
          phases: [validPhase],
          rewardDice: {
            frequency: 1,
            sides: [
              { icon: 'tea', title: 'Tea', weight },
              { icon: 'walk', title: 'Walk', weight: 1 },
            ],
          },
        }),
      ).toThrow('Reward Dice weights must be finite positive numbers.');
    },
  );

  test('rejects a mixture of custom and omitted weights', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          frequency: 1,
          sides: [
            { icon: 'tea', title: 'Tea', weight: 2 },
            { icon: 'walk', title: 'Walk' },
          ],
        },
      }),
    ).toThrow(
      'Reward Dice weights must be provided for every side or omitted for every side.',
    );
  });
});
