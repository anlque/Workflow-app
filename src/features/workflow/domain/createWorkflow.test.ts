import { describe, expect, test } from 'vitest';

import { createWorkflow } from './createWorkflow';

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

    expect(workflow.rewardDice?.triggerPhaseType).toBe('focus');
  });

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

    expect(workflow.rewardDice?.triggerPhaseType).toBe('break');
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
