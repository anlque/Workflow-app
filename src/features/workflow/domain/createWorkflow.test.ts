import { describe, expect, test } from 'vitest';

import { createWorkflow } from './createWorkflow';
import type { CreateWorkflowInput } from './Workflow';
import { WorkflowValidationError } from './WorkflowErrors';
import { rewardOpportunityPhaseIndexes } from './rewardOpportunityPhaseIndexes';

const validPhase = {
  type: 'focus',
  durationSeconds: 1_500,
  environment: {
    backgroundColor: '#102030',
  },
} as const;

const detailedInputTypeProof = {
  id: 'detailed-type-proof',
  name: 'Detailed',
  phases: [validPhase],
} satisfies CreateWorkflowInput;
const quickInputTypeProof = {
  mode: 'quick',
  id: 'quick-type-proof',
  name: 'Quick',
  configuration: {
    cycleCount: 1,
    focus: { durationSeconds: 30, environment: {} },
    shortBreak: { durationSeconds: 30, environment: {} },
  },
} satisfies CreateWorkflowInput;
// @ts-expect-error Quick inputs cannot carry generated Detailed Phases.
const mixedQuickInputTypeProof: CreateWorkflowInput = {
  ...quickInputTypeProof,
  phases: [validPhase],
};
// @ts-expect-error Detailed inputs cannot carry Quick configuration.
const mixedDetailedInputTypeProof: CreateWorkflowInput = {
  ...detailedInputTypeProof,
  configuration: quickInputTypeProof.configuration,
};
void mixedQuickInputTypeProof;
void mixedDetailedInputTypeProof;

describe('createWorkflow', () => {
  test('keeps Quick and Detailed constructor inputs type-exclusive', () => {
    expect(createWorkflow(detailedInputTypeProof).mode).toBe('detailed');
    expect(createWorkflow(quickInputTypeProof).mode).toBe('quick');
  });
  test('defaults a legacy constructor input to Detailed mode', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [validPhase],
    });

    expect(workflow.mode).toBe('detailed');
    expect(workflow).not.toHaveProperty('configuration');
  });

  test('creates a deeply immutable Quick configuration beside its executable projection', () => {
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick-1',
      name: 'Quick rhythm',
      configuration: {
        cycleCount: 4,
        focus: {
          durationSeconds: 1_500,
          environment: { backgroundColor: '#123456' },
        },
        shortBreak: { durationSeconds: 300, environment: {} },
        longBreak: { durationSeconds: 900, environment: {}, frequency: 3 },
        rewardDice: {
          frequency: 2,
          sides: [
            { icon: 'tea', title: 'Tea', weight: 2 },
            { icon: 'walk', title: 'Walk', weight: 4 },
          ],
        },
      },
    });

    expect(workflow.mode).toBe('quick');
    if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow');
    expect(workflow.phases.map(({ name }) => name)).toEqual([
      'Focus',
      'Short break',
      'Focus',
      'Short break',
      'Focus',
      'Long break',
      'Focus',
      'Short break',
    ]);
    expect(workflow.rewardDice).toMatchObject({
      schedule: { type: 'frequency', triggerPhaseType: 'break', frequency: 2 },
      rerolls: 0,
    });
    expect(
      workflow.rewardDice?.sides.map(({ probability }) => probability),
    ).toEqual([1 / 3, 2 / 3]);
    expect(
      workflow.configuration.rewardDice?.sides.map(({ weight }) => weight),
    ).toEqual([2, 4]);
    expect(Object.isFrozen(workflow.configuration)).toBe(true);
    expect(Object.isFrozen(workflow.configuration.focus.environment)).toBe(
      true,
    );
    expect(Object.isFrozen(workflow.configuration.rewardDice?.sides)).toBe(
      true,
    );
  });

  test.each([0, 21, 1.5, Number.NaN])(
    'rejects invalid Quick cycle count %s',
    (cycleCount) => {
      expect(() =>
        createWorkflow({
          mode: 'quick',
          id: 'quick-1',
          name: 'Quick',
          configuration: {
            cycleCount,
            focus: { durationSeconds: 1_500, environment: {} },
            shortBreak: { durationSeconds: 300, environment: {} },
          },
        }),
      ).toThrow(
        'Quick Workflow cycle count must be an integer from 1 through 20.',
      );
    },
  );

  test.each([
    ['Focus', 'focus', 29],
    ['Focus', 'focus', 31],
    ['Short Break', 'shortBreak', 0],
    ['Short Break', 'shortBreak', 45],
    ['Long Break', 'longBreak', -30],
    ['Long Break', 'longBreak', 61],
  ] as const)(
    'rejects invalid Quick %s duration',
    (_label, field, durationSeconds) => {
      const base = {
        cycleCount: 2,
        focus: { durationSeconds: 1_500, environment: {} },
        shortBreak: { durationSeconds: 300, environment: {} },
        longBreak: { durationSeconds: 900, environment: {}, frequency: 2 },
      };
      const configuration = {
        ...base,
        ...(field === 'focus'
          ? { focus: { ...base.focus, durationSeconds } }
          : field === 'shortBreak'
            ? { shortBreak: { ...base.shortBreak, durationSeconds } }
            : { longBreak: { ...base.longBreak, durationSeconds } }),
      };

      expect(() =>
        createWorkflow({
          mode: 'quick',
          id: 'quick-duration',
          name: 'Quick',
          configuration,
        }),
      ).toThrow(
        'Quick Workflow durations must be at least 30 seconds and use 30-second increments.',
      );
    },
  );

  test('keeps positive whole-second durations valid for Detailed Workflows', () => {
    expect(
      createWorkflow({
        id: 'detailed-seconds',
        name: 'Detailed',
        phases: [{ ...validPhase, durationSeconds: 1 }],
      }).phases[0].durationSeconds,
    ).toBe(1);
  });

  test('materializes all accepted Quick cadence combinations deterministically', () => {
    for (let cycleCount = 1; cycleCount <= 20; cycleCount += 1) {
      for (let frequency = 1; frequency <= cycleCount; frequency += 1) {
        const workflow = createWorkflow({
          mode: 'quick',
          id: `quick-${String(cycleCount)}-${String(frequency)}`,
          name: 'Quick',
          configuration: {
            cycleCount,
            focus: { durationSeconds: 1_500, environment: {} },
            shortBreak: { durationSeconds: 300, environment: {} },
            longBreak: { durationSeconds: 900, environment: {}, frequency },
            rewardDice: {
              frequency,
              sides: [
                { icon: 'tea', title: 'Tea' },
                { icon: 'walk', title: 'Walk' },
              ],
            },
          },
        });
        expect(workflow.phases).toHaveLength(cycleCount * 2);
        expect(workflow.phases.at(-1)?.type).toBe('break');
        expect(
          workflow.phases.filter(({ name }) => name === 'Long break'),
        ).toHaveLength(Math.floor(cycleCount / frequency));
        expect(rewardOpportunityPhaseIndexes(workflow)).toEqual(
          Array.from(
            { length: Math.floor(cycleCount / frequency) },
            (_, index) => (index + 1) * frequency * 2 - 1,
          ),
        );
      }
    }
  });

  test('projects the configured duration and Environment for every Quick cadence segment', () => {
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick-projection',
      name: 'Quick',
      configuration: {
        cycleCount: 3,
        focus: {
          durationSeconds: 60,
          environment: { backgroundColor: '#111111' },
        },
        shortBreak: {
          durationSeconds: 90,
          environment: { backgroundColor: '#222222' },
        },
        longBreak: {
          durationSeconds: 120,
          environment: { backgroundColor: '#333333' },
          frequency: 2,
        },
      },
    });
    expect(
      workflow.phases.map(({ durationSeconds, environment }) => ({
        durationSeconds,
        backgroundColor: environment.backgroundColor,
      })),
    ).toEqual([
      { durationSeconds: 60, backgroundColor: '#111111' },
      { durationSeconds: 90, backgroundColor: '#222222' },
      { durationSeconds: 60, backgroundColor: '#111111' },
      { durationSeconds: 120, backgroundColor: '#333333' },
      { durationSeconds: 60, backgroundColor: '#111111' },
      { durationSeconds: 90, backgroundColor: '#222222' },
    ]);
  });

  test.each([
    [
      'Long Break',
      { longBreak: { durationSeconds: 300, environment: {}, frequency: 3 } },
    ],
    [
      'Reward',
      {
        rewardDice: {
          frequency: 3,
          sides: [
            { icon: 'a', title: 'A' },
            { icon: 'b', title: 'B' },
          ],
        },
      },
    ],
  ] as const)('rejects %s frequency above cycle count', (_label, extension) => {
    expect(() =>
      createWorkflow({
        mode: 'quick',
        id: 'quick-frequency',
        name: 'Quick',
        configuration: {
          cycleCount: 2,
          focus: { durationSeconds: 1_500, environment: {} },
          shortBreak: { durationSeconds: 300, environment: {} },
          ...extension,
        },
      }),
    ).toThrow('must be an integer from 1 through the cycle count.');
  });

  test.each([0, 1.5, Number.NaN])(
    'rejects invalid Quick Long Break and Reward frequency %s',
    (frequency) => {
      for (const extension of [
        { longBreak: { durationSeconds: 300, environment: {}, frequency } },
        {
          rewardDice: {
            frequency,
            sides: [
              { icon: 'a', title: 'A' },
              { icon: 'b', title: 'B' },
            ],
          },
        },
      ]) {
        expect(() =>
          createWorkflow({
            mode: 'quick',
            id: 'quick-invalid-frequency',
            name: 'Quick',
            configuration: {
              cycleCount: 2,
              focus: { durationSeconds: 1_500, environment: {} },
              shortBreak: { durationSeconds: 300, environment: {} },
              ...extension,
            },
          }),
        ).toThrow('must be an integer from 1 through the cycle count.');
      }
    },
  );

  test('rejects a Quick Reward after cycle count is reduced below its frequency', () => {
    expect(() =>
      createWorkflow({
        mode: 'quick',
        id: 'quick-reduced',
        name: 'Quick',
        configuration: {
          cycleCount: 1,
          focus: { durationSeconds: 1_500, environment: {} },
          shortBreak: { durationSeconds: 300, environment: {} },
          rewardDice: {
            frequency: 2,
            sides: [
              { icon: 'a', title: 'A' },
              { icon: 'b', title: 'B' },
            ],
          },
        },
      }),
    ).toThrow(
      'Quick Reward frequency must be an integer from 1 through the cycle count.',
    );
  });

  test.each([
    [
      'fewer than two sides',
      [{ icon: 'a', title: 'A' }],
      'Reward Dice must contain at least two sides.',
    ],
    [
      'blank icon',
      [
        { icon: ' ', title: 'A' },
        { icon: 'b', title: 'B' },
      ],
      'Dice Side icon must not be empty.',
    ],
    [
      'blank title',
      [
        { icon: 'a', title: ' ' },
        { icon: 'b', title: 'B' },
      ],
      'Dice Side title must not be empty.',
    ],
    [
      'partial weights',
      [
        { icon: 'a', title: 'A', weight: 1 },
        { icon: 'b', title: 'B' },
      ],
      'Reward Dice weights must be provided for every side or omitted for every side.',
    ],
    [
      'zero weight',
      [
        { icon: 'a', title: 'A', weight: 0 },
        { icon: 'b', title: 'B', weight: 1 },
      ],
      'Reward Dice weights must be finite positive numbers.',
    ],
    [
      'negative weight',
      [
        { icon: 'a', title: 'A', weight: -1 },
        { icon: 'b', title: 'B', weight: 1 },
      ],
      'Reward Dice weights must be finite positive numbers.',
    ],
    [
      'non-finite weight',
      [
        { icon: 'a', title: 'A', weight: Number.POSITIVE_INFINITY },
        { icon: 'b', title: 'B', weight: 1 },
      ],
      'Reward Dice weights must be finite positive numbers.',
    ],
  ] as const)('rejects Quick Reward %s', (_label, sides, message) => {
    expect(() =>
      createWorkflow({
        mode: 'quick',
        id: 'quick-sides',
        name: 'Quick',
        configuration: {
          cycleCount: 2,
          focus: { durationSeconds: 1_500, environment: {} },
          shortBreak: { durationSeconds: 300, environment: {} },
          rewardDice: { frequency: 1, sides },
        },
      }),
    ).toThrow(message);
  });
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

  test('normalizes an optional Phase name and omits a blank name', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [
        { ...validPhase, name: '  Writing  ' },
        { ...validPhase, name: '   ' },
      ],
    });

    expect(workflow.phases[0]).toMatchObject({ name: 'Writing' });
    expect(workflow.phases[1]).not.toHaveProperty('name');
    expect(Object.isFrozen(workflow.phases[0])).toBe(true);
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
    expect(workflow.rewardDice?.sides[0]?.availability).toBe('any');
    expect(Object.isFrozen(workflow.rewardDice?.sides[0])).toBe(true);
  });

  test('creates a normalized deeply immutable Bonus Reward Phase', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [validPhase],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'tea',
            title: 'Tea',
            bonusPhase: {
              name: '  Tea break  ',
              durationSeconds: 300,
              environment: {
                backgroundAsset: { type: 'role', role: 'Backdrop' },
                audioAsset: { type: 'direct', assetId: 'audio-1' },
                backgroundColor: '#123456',
              },
            },
          },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    const [withBonus, withoutBonus] = workflow.rewardDice?.sides ?? [];
    expect(withBonus?.bonusPhase).toEqual({
      name: 'Tea break',
      durationSeconds: 300,
      environment: {
        backgroundAsset: { type: 'role', role: 'Backdrop' },
        audioAsset: { type: 'direct', assetId: 'audio-1' },
        backgroundColor: '#123456',
      },
    });
    expect(Object.isFrozen(withBonus?.bonusPhase)).toBe(true);
    expect(Object.isFrozen(withBonus?.bonusPhase?.environment)).toBe(true);
    expect(
      Object.isFrozen(withBonus?.bonusPhase?.environment.backgroundAsset),
    ).toBe(true);
    expect(withoutBonus).not.toHaveProperty('bonusPhase');
  });

  test.each([
    [
      'blank name',
      { name: '  ', durationSeconds: 300, environment: {} },
      'Bonus Reward Phase name must not be empty.',
    ],
    [
      'zero duration',
      { name: 'Tea', durationSeconds: 0, environment: {} },
      'Phase duration must be a positive integer number of seconds.',
    ],
    [
      'fractional duration',
      { name: 'Tea', durationSeconds: 1.5, environment: {} },
      'Phase duration must be a positive integer number of seconds.',
    ],
    [
      'malformed Environment',
      {
        name: 'Tea',
        durationSeconds: 300,
        environment: {
          audioAsset: { type: 'direct', assetId: 'audio-1', role: 'Ambient' },
        },
      },
      'Asset reference must be direct or role-based.',
    ],
  ])('rejects Bonus Reward Phase with %s', (_case, bonusPhase, message) => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          frequency: 1,
          sides: [
            { icon: 'tea', title: 'Tea', bonusPhase } as never,
            { icon: 'walk', title: 'Walk' },
          ],
        },
      }),
    ).toThrow(message);
  });

  test.each(['sometimes', '', null])(
    'rejects invalid Dice Side availability %j',
    (availability) => {
      expect(() =>
        createWorkflow({
          id: 'workflow-1',
          name: 'Deep work',
          phases: [validPhase],
          rewardDice: {
            frequency: 1,
            sides: [
              { icon: 'tea', title: 'Tea', availability } as never,
              { icon: 'walk', title: 'Walk' },
            ],
          },
        }),
      ).toThrow('Dice Side availability must be any, early or late.');
    },
  );

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

  test.each([{ triggerPhaseType: 'break' }, { frequency: 2 }])(
    'rejects canonical schedule combined with top-level legacy timing fields %#',
    (legacyField) => {
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
            ...legacyField,
            sides: [
              { icon: 'tea', title: 'Tea' },
              { icon: 'walk', title: 'Walk' },
            ],
          } as never,
        }),
      ).toThrow(WorkflowValidationError);
    },
  );

  test.each([
    {
      schedule: { type: 'custom' },
      message: 'Custom Reward phase indexes must be unique in-range integers.',
    },
    {
      schedule: { type: 'frequency', triggerPhaseType: 'focus' },
      message: 'Reward Dice frequency must be a positive integer.',
    },
  ])(
    'preserves the required-value error for $schedule.type',
    ({ schedule, message }) => {
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
      ).toThrow(message);
    },
  );

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

  test('validates custom index values before extra own fields', () => {
    expect(() =>
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [validPhase],
        rewardDice: {
          schedule: { type: 'custom', phaseIndexes: [-1], extra: true },
          sides: [
            { icon: 'tea', title: 'Tea' },
            { icon: 'walk', title: 'Walk' },
          ],
        } as never,
      }),
    ).toThrow('Custom Reward phase indexes must be unique in-range integers.');
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
