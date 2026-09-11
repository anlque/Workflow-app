import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession, pauseSession } from '../domain/Session';
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

  test('defaults missing Reward Dice rerolls in a runtime Session projection', () => {
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

    const restored = parseSessionProjection(legacyProjection);

    expect(restored?.snapshot.workflow.rewardDice?.rerolls).toBe(0);
  });

  test('reads canonical custom and legacy frequency schedules', () => {
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
    expect(
      parseSessionProjection(legacy)?.snapshot.workflow.rewardDice?.schedule,
    ).toEqual({
      type: 'frequency',
      triggerPhaseType: 'focus',
      frequency: 1,
    });
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
});
