import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  pauseSession,
  rollSessionReward,
} from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { parseSessionProjection } from './parseSessionProjection';

function workflowWithReward() {
  return createWorkflow({
    id: 'reward-workflow',
    name: 'Reward',
    phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    rewardDice: {
      frequency: 1,
      sides: [
        { icon: '☕', title: 'Tea' },
        { icon: '🌿', title: 'Fresh air' },
      ],
    },
  });
}

describe('parseSessionProjection', () => {
  test('accepts only canonical active Bonus projection state', () => {
    const rewarded = createWorkflow({
      id: 'projection-bonus-workflow',
      name: 'Projection Bonus',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
      ],
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
    const paused = deriveSessionState(
      createSession('projection-bonus', rewarded, 1_000),
      3_000,
    );
    const running = continueRewardSession(
      rollSessionReward(paused, () => 0, 'roll-projection'),
      4_000,
      'continue-projection',
    );

    expect(parseSessionProjection(structuredClone(running))).toEqual(running);
    const corrupt = structuredClone(running) as unknown as {
      activeBonusPhase: Record<string, unknown>;
    };
    corrupt.activeBonusPhase['extra'] = true;
    expect(() => parseSessionProjection(corrupt)).toThrow(
      'Session projection is invalid.',
    );
  });

  test('restores a transport-safe Session projection', () => {
    const value = createSession(
      'session-1',
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
      }),
      1_000,
    );
    expect(parseSessionProjection(structuredClone(value))).toEqual(value);
  });

  test('rejects legacy Reward Dice defaults in a runtime Session projection', () => {
    const value = createSession(
      'legacy-reward-session',
      createWorkflow({
        id: 'legacy-reward-workflow',
        name: 'Legacy Reward',
        phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
        rewardDice: {
          frequency: 1,
          rerolls: 3,
          sides: [
            { icon: '☕', title: 'Tea' },
            { icon: '🌿', title: 'Fresh air' },
          ],
        },
      }),
      1_000,
    );
    const legacyProjection = structuredClone(value) as {
      snapshot: { workflow: { rewardDice?: Record<string, unknown> } };
    };
    const legacyReward = legacyProjection.snapshot.workflow.rewardDice;
    if (legacyReward === undefined) {
      throw new Error('Expected projected Reward Dice.');
    }
    delete legacyReward['rerolls'];
    for (const side of legacyReward['sides'] as Record<string, unknown>[]) {
      delete side['availability'];
    }

    expect(() => parseSessionProjection(legacyProjection)).toThrow(
      'Session projection is invalid.',
    );
  });

  test('rejects malformed runtime Side availability', () => {
    const value = structuredClone(
      createSession('invalid-side', workflowWithReward(), 1_000),
    ) as unknown as {
      snapshot: {
        workflow: { rewardDice: { sides: Record<string, unknown>[] } };
      };
    };
    const firstSide = value.snapshot.workflow.rewardDice.sides[0];
    if (firstSide === undefined) throw new Error('Expected first Dice Side.');
    firstSide['availability'] = 'sometimes';

    expect(() => parseSessionProjection(value)).toThrow(
      'Session projection is invalid.',
    );
  });

  test('restores a canonical Bonus Reward Phase with direct references', () => {
    const value = createSession(
      'bonus-session',
      createWorkflow({
        id: 'bonus-workflow',
        name: 'Bonus',
        phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
        rewardDice: {
          frequency: 1,
          sides: [
            {
              icon: 'tea',
              title: 'Tea',
              bonusPhase: {
                name: 'Tea break',
                durationSeconds: 300,
                environment: {
                  backgroundAsset: { type: 'direct', assetId: 'image-1' },
                },
              },
            },
            { icon: 'walk', title: 'Walk' },
          ],
        },
      }),
      1_000,
    );

    expect(
      parseSessionProjection(structuredClone(value))?.snapshot.workflow
        .rewardDice?.sides[0]?.bonusPhase,
    ).toEqual(value.snapshot.workflow.rewardDice?.sides[0]?.bonusPhase);
  });

  test.each([
    {
      name: 'Bonus',
      durationSeconds: 300,
      environment: {},
      extra: true,
    },
    {
      name: 'Bonus',
      durationSeconds: 300,
      environment: { audioAsset: { type: 'role', role: 'Ambient' } },
    },
  ])('rejects malformed canonical Bonus projection', (bonusPhase) => {
    const value = structuredClone(
      createSession('invalid-bonus', workflowWithReward(), 1_000),
    ) as unknown as {
      snapshot: {
        workflow: { rewardDice: { sides: Record<string, unknown>[] } };
      };
    };
    const firstSide = value.snapshot.workflow.rewardDice.sides[0];
    if (firstSide === undefined) throw new Error('Expected first Dice Side.');
    firstSide['bonusPhase'] = bonusPhase;

    expect(() => parseSessionProjection(value)).toThrow(
      'Session projection is invalid.',
    );
  });

  test('reads canonical custom and rejects legacy frequency schedules', () => {
    const canonical = createSession(
      'custom-session',
      createWorkflow({
        id: 'custom-workflow',
        name: 'Custom',
        phases: [
          { type: 'focus', durationSeconds: 60, environment: {} },
          { type: 'break', durationSeconds: 60, environment: {} },
        ],
        rewardDice: {
          schedule: { type: 'custom', phaseIndexes: [1] },
          sides: [
            { icon: '☕', title: 'Tea' },
            { icon: '🌿', title: 'Fresh air' },
          ],
        },
      }),
      1_000,
    );
    expect(
      parseSessionProjection(structuredClone(canonical))?.snapshot.workflow
        .rewardDice?.schedule,
    ).toEqual({ type: 'custom', phaseIndexes: [1] });

    const legacy = structuredClone(canonical) as {
      snapshot: { workflow: { rewardDice?: Record<string, unknown> } };
    };
    const reward = legacy.snapshot.workflow.rewardDice;
    if (reward === undefined) throw new Error('Expected Reward Dice.');
    delete reward['schedule'];
    reward['frequency'] = 1;
    expect(() => parseSessionProjection(legacy)).toThrow(
      'Session projection is invalid.',
    );
  });

  test.each([
    { type: 'frequency', frequency: 1 },
    { type: 'custom', phaseIndexes: [0], frequency: 1 },
    { type: 'unknown', phaseIndexes: [0] },
  ])('rejects malformed canonical schedule %#', (schedule) => {
    const value = structuredClone(
      createSession('session-1', workflowWithReward(), 1_000),
    ) as { snapshot: { workflow: { rewardDice?: Record<string, unknown> } } };
    const reward = value.snapshot.workflow.rewardDice;
    if (reward === undefined) throw new Error('Expected Reward Dice.');
    reward['schedule'] = schedule;
    expect(() => parseSessionProjection(value)).toThrow(
      'Session projection is invalid.',
    );
  });

  test('accepts null and rejects malformed values', () => {
    expect(parseSessionProjection(null)).toBeNull();
    expect(() => parseSessionProjection({ status: 'running' })).toThrow();
  });

  test('restores transitioning and reasoned paused projections', () => {
    const value = createSession(
      'session-1',
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [
          { type: 'focus', durationSeconds: 10, environment: {} },
          { type: 'break', durationSeconds: 5, environment: {} },
        ],
      }),
      1_000,
    );
    const transitioning = deriveSessionState(value, 11_000);
    const paused = pauseSession(value, 3_000);

    expect(parseSessionProjection(structuredClone(transitioning))).toEqual(
      transitioning,
    );
    expect(parseSessionProjection(structuredClone(paused))).toEqual(paused);
  });

  test('rejects a paused projection with a missing or unknown reason', () => {
    const paused = structuredClone(
      pauseSession(
        createSession(
          'session-1',
          createWorkflow({
            id: 'workflow-1',
            name: 'Deep work',
            phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
          }),
          1_000,
        ),
        3_000,
      ),
    ) as Record<string, unknown>;

    delete paused['pauseReason'];
    expect(() => parseSessionProjection(paused)).toThrow();
    expect(() =>
      parseSessionProjection({ ...paused, pauseReason: 'automatic' }),
    ).toThrow();
  });

  test('requires canonical Reward receipts in every runtime projection', () => {
    const value = structuredClone(
      createSession('session-1', workflowWithReward(), 1_000),
    ) as Record<string, unknown>;
    delete value['rewardCommandReceipts'];

    expect(() => parseSessionProjection(value)).toThrow(
      'Session projection is invalid.',
    );
  });

  test('rejects a final Reward projection without its ritual', () => {
    const finalReward = structuredClone(
      deriveSessionState(
        createSession('session-final', workflowWithReward(), 1_000),
        62_000,
      ),
    ) as Record<string, unknown>;
    expect(finalReward['status']).toBe('paused');
    delete finalReward['rewardRitual'];

    expect(() => parseSessionProjection(finalReward)).toThrow(
      'Session Reward ritual is invalid.',
    );
  });

  test.each([
    ['Session', (value: Record<string, unknown>) => value],
    [
      'snapshot',
      (value: Record<string, unknown>) =>
        value['snapshot'] as Record<string, unknown>,
    ],
    [
      'Workflow',
      (value: Record<string, unknown>) =>
        (value['snapshot'] as { workflow: Record<string, unknown> }).workflow,
    ],
    [
      'Phase',
      (value: Record<string, unknown>) => {
        const phase = (
          value['snapshot'] as {
            workflow: { phases: Record<string, unknown>[] };
          }
        ).workflow.phases[0];
        if (phase === undefined) throw new Error('Expected Phase.');
        return phase;
      },
    ],
    [
      'Environment',
      (value: Record<string, unknown>) =>
        (
          (
            value['snapshot'] as {
              workflow: { phases: { environment: Record<string, unknown> }[] };
            }
          ).workflow.phases[0] as { environment: Record<string, unknown> }
        ).environment,
    ],
  ] as const)('rejects extra %s projection keys', (_label, target) => {
    const value = structuredClone(
      createSession('strict-shape', workflowWithReward(), 1_000),
    ) as unknown as Record<string, unknown>;
    target(value)['extra'] = true;

    expect(() => parseSessionProjection(value)).toThrow(
      'Session projection is invalid.',
    );
  });

  test.each(['backgroundAssetId', 'audioAssetId'] as const)(
    'rejects legacy Environment field %s',
    (field) => {
      const value = structuredClone(
        createSession('legacy-environment', workflowWithReward(), 1_000),
      ) as unknown as {
        snapshot: {
          workflow: { phases: { environment: Record<string, unknown> }[] };
        };
      };
      const environment = value.snapshot.workflow.phases[0]?.environment;
      if (environment === undefined) throw new Error('Expected Environment.');
      environment[field] = 'asset-1';

      expect(() => parseSessionProjection(value)).toThrow(
        'Session projection is invalid.',
      );
    },
  );

  test('rejects Role references and a mismatched source Workflow ID', () => {
    const withRole = structuredClone(
      createSession('role-reference', workflowWithReward(), 1_000),
    ) as unknown as {
      snapshot: {
        workflow: { phases: { environment: Record<string, unknown> }[] };
      };
    };
    const environment = withRole.snapshot.workflow.phases[0]?.environment;
    if (environment === undefined) throw new Error('Expected Environment.');
    environment['backgroundAsset'] = { type: 'role', role: 'Backdrop' };
    expect(() => parseSessionProjection(withRole)).toThrow(
      'Session projection is invalid.',
    );

    const mismatched = structuredClone(
      createSession('source-mismatch', workflowWithReward(), 1_000),
    ) as unknown as Record<string, unknown>;
    mismatched['sourceWorkflowId'] = 'another-workflow';
    expect(() => parseSessionProjection(mismatched)).toThrow(
      'Session projection is invalid.',
    );
  });
});
