import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  pauseSession,
  rollSessionReward,
  stopSession,
} from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { didCrossPhaseBoundary } from './didCrossPhaseBoundary';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    { type: 'focus', durationSeconds: 1, environment: {} },
    { type: 'break', durationSeconds: 1, environment: {} },
    { type: 'focus', durationSeconds: 1, environment: {} },
  ],
});

describe('didCrossPhaseBoundary', () => {
  test('detects one observed Phase transition', () => {
    const initial = createSession('session-1', workflow, 1_000);

    expect(
      didCrossPhaseBoundary(initial, deriveSessionState(initial, 2_000)),
    ).toBe(true);
  });

  test('collapses skipped Phase transitions into one boundary event', () => {
    const initial = createSession('session-1', workflow, 1_000);

    expect(
      didCrossPhaseBoundary(initial, deriveSessionState(initial, 5_000)),
    ).toBe(true);
  });

  test('treats Session completion as the final Phase boundary', () => {
    const initial = createSession('session-1', workflow, 1_000);

    expect(
      didCrossPhaseBoundary(initial, deriveSessionState(initial, 7_000)),
    ).toBe(true);
  });

  test('ignores duplicate projections and same-Phase pause or stop transitions', () => {
    const initial = createSession('session-1', workflow, 1_000);

    expect(didCrossPhaseBoundary(initial, initial)).toBe(false);
    expect(didCrossPhaseBoundary(initial, pauseSession(initial, 1_500))).toBe(
      false,
    );
    expect(didCrossPhaseBoundary(initial, stopSession(initial, 1_500))).toBe(
      false,
    );
  });

  test('does not ring again when an observed transition finishes', () => {
    const initial = createSession('session-1', workflow, 1_000);
    const transitioning = deriveSessionState(initial, 2_000);
    const nextPhase = deriveSessionState(transitioning, 3_000);

    expect(didCrossPhaseBoundary(transitioning, nextPhase)).toBe(false);
  });

  test('ignores projections from another Session', () => {
    const initial = createSession('session-1', workflow, 1_000);
    const another = deriveSessionState(
      createSession('session-2', workflow, 1_000),
      2_000,
    );

    expect(didCrossPhaseBoundary(initial, another)).toBe(false);
  });

  test('rings once when a non-final Bonus reveals its normal continuation', () => {
    const rewarded = createWorkflow({
      id: 'bonus-boundary',
      name: 'Bonus boundary',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
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
      createSession('bonus-boundary-session', rewarded, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(paused, () => 0),
      4_000,
      'continue-boundary',
    );
    const normal = deriveSessionState(bonus, 34_000);

    expect(didCrossPhaseBoundary(bonus, normal)).toBe(true);
    expect(didCrossPhaseBoundary(normal, normal)).toBe(false);
  });

  test('does not ring when a final Bonus reveals Session completion', () => {
    const rewarded = createWorkflow({
      id: 'final-bonus-boundary',
      name: 'Final Bonus boundary',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
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
      createSession('final-bonus-boundary-session', rewarded, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(paused, () => 0),
      4_000,
      'continue-final-boundary',
    );
    const completed = deriveSessionState(bonus, 34_000);

    expect(didCrossPhaseBoundary(bonus, completed)).toBe(false);
    expect(didCrossPhaseBoundary(completed, completed)).toBe(false);
  });

  test.each([
    ['running non-final', 'running-non-final', false, false],
    ['paused non-final', 'paused-non-final', false, true],
    ['running final', 'running-final', true, false],
    ['paused final', 'paused-final', true, true],
  ] as const)(
    'does not ring when stopping a %s Bonus',
    (_label, fixtureId, isFinal, isPaused) => {
      const rewarded = createWorkflow({
        id: `stopped-bonus-${fixtureId}`,
        name: 'Stopped Bonus boundary',
        phases: [
          { type: 'focus', durationSeconds: 1, environment: {} },
          ...(!isFinal
            ? [
                {
                  type: 'break' as const,
                  durationSeconds: 5,
                  environment: {},
                },
              ]
            : []),
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
      const reward = deriveSessionState(
        createSession(`stopped-bonus-${fixtureId}`, rewarded, 1_000),
        3_000,
      );
      const runningBonus = continueRewardSession(
        rollSessionReward(reward, () => 0),
        4_000,
        `continue-stopped-${fixtureId}`,
      );
      const activeBonus = isPaused
        ? pauseSession(runningBonus, 5_000)
        : runningBonus;
      const stopped = stopSession(activeBonus, 6_000);

      expect(didCrossPhaseBoundary(activeBonus, stopped)).toBe(false);
      expect(didCrossPhaseBoundary(stopped, stopped)).toBe(false);
    },
  );

  test.each([
    ['transitioning', 39_000, 'transitioning'],
    ['completed', 40_000, 'completed'],
  ] as const)(
    'rings once when a late non-final Bonus reaches %s',
    (_label, now, expectedStatus) => {
      const rewarded = createWorkflow({
        id: `late-bonus-${expectedStatus}`,
        name: 'Late Bonus boundary',
        phases: [
          { type: 'focus', durationSeconds: 1, environment: {} },
          { type: 'break', durationSeconds: 5, environment: {} },
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
        createSession(`late-${expectedStatus}`, rewarded, 1_000),
        3_000,
      );
      const bonus = continueRewardSession(
        rollSessionReward(paused, () => 0),
        4_000,
        `continue-${expectedStatus}`,
      );
      const late = deriveSessionState(bonus, now);

      expect(late.status).toBe(expectedStatus);
      expect(didCrossPhaseBoundary(bonus, late)).toBe(true);
      expect(didCrossPhaseBoundary(late, late)).toBe(false);
    },
  );

  test('rings once when a late non-final Bonus reaches another Reward pause', () => {
    const rewarded = createWorkflow({
      id: 'late-bonus-reward',
      name: 'Late Bonus Reward boundary',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
        { type: 'focus', durationSeconds: 5, environment: {} },
      ],
      rewardDice: {
        schedule: { type: 'custom', phaseIndexes: [0, 1] },
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
      createSession('late-bonus-reward', rewarded, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(paused, () => 0),
      4_000,
      'continue-late-reward',
    );
    const nextReward = deriveSessionState(bonus, 40_000);

    expect(nextReward).toMatchObject({
      status: 'paused',
      pauseReason: 'reward',
      currentPhaseIndex: 2,
    });
    expect(didCrossPhaseBoundary(bonus, nextReward)).toBe(true);
    expect(didCrossPhaseBoundary(nextReward, nextReward)).toBe(false);
  });
});
