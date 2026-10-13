import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  pauseSession,
  rollSessionReward,
  restartSessionPhase,
  restartSessionWorkflow,
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

const bonusWorkflow = () =>
  createWorkflow({
    id: 'bonus-workflow-restart',
    name: 'Bonus workflow restart',
    phases: [
      { type: 'focus', durationSeconds: 10, environment: {} },
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

function activeBonus() {
  return continueRewardSession(
    rollSessionReward(
      deriveSessionState(
        createSession('bonus-workflow-restart', bonusWorkflow(), 1_000),
        12_000,
      ),
      () => 0,
      'roll-before-workflow-restart',
    ),
    20_000,
    'continue-before-workflow-restart',
  );
}

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

  test('does not treat phase or workflow restart as a Phase boundary', () => {
    const phaseOne = deriveSessionState(
      createSession('restart-boundary', workflow, 1_000),
      3_000,
    );
    const phaseRestart = restartSessionPhase(phaseOne, 3_500, 'restart-phase', {
      type: 'phase',
      phaseIndex: 1,
    });
    const workflowRestart = restartSessionWorkflow(
      phaseRestart,
      4_000,
      'restart-workflow',
    );

    expect(didCrossPhaseBoundary(phaseOne, phaseRestart)).toBe(false);
    expect(didCrossPhaseBoundary(phaseRestart, workflowRestart)).toBe(false);
  });

  test('does not treat workflow restart from an active Bonus as a Phase boundary', () => {
    const bonus = activeBonus();
    const restarted = restartSessionWorkflow(
      bonus,
      21_000,
      'restart-workflow-from-bonus',
    );

    expect(didCrossPhaseBoundary(bonus, restarted)).toBe(false);
  });

  test('detects a real boundary when the immediate workflow restart projection was missed', () => {
    const bonus = activeBonus();
    const restarted = restartSessionWorkflow(
      bonus,
      21_000,
      'restart-workflow-from-bonus',
    );
    const transitioning = deriveSessionState(restarted, 31_000);

    expect(transitioning.status).toBe('transitioning');
    expect(didCrossPhaseBoundary(bonus, transitioning)).toBe(true);
  });

  test('does not emit a second boundary after a missed restart projection reached transitioning', () => {
    const bonus = activeBonus();
    const restarted = restartSessionWorkflow(
      bonus,
      21_000,
      'restart-workflow-from-bonus',
    );
    const transitioning = deriveSessionState(restarted, 31_000);
    const rewardPaused = deriveSessionState(transitioning, 32_000);

    expect(rewardPaused).toMatchObject({
      status: 'paused',
      pauseReason: 'reward',
    });
    expect(didCrossPhaseBoundary(transitioning, rewardPaused)).toBe(false);
  });

  test('suppresses workflow restart received first as a user-paused Phase 0 projection', () => {
    const bonus = activeBonus();
    const restarted = restartSessionWorkflow(
      bonus,
      21_000,
      'restart-workflow-from-bonus',
    );
    const paused = pauseSession(restarted, 22_000);

    expect(didCrossPhaseBoundary(bonus, paused)).toBe(false);
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

  test('detects terminal completion after a final Bonus skipped workflow restart projections', () => {
    const rewarded = createWorkflow({
      id: 'final-bonus-restart-boundary',
      name: 'Final Bonus restart boundary',
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
    const firstReward = deriveSessionState(
      createSession('final-bonus-restart-session', rewarded, 1_000),
      3_000,
    );
    const finalBonus = continueRewardSession(
      rollSessionReward(firstReward, () => 0, 'first-roll'),
      4_000,
      'first-continue',
    );
    const restarted = restartSessionWorkflow(
      finalBonus,
      5_000,
      'restart-final-workflow',
    );
    const secondReward = deriveSessionState(restarted, 7_000);
    const completed = continueRewardSession(
      rollSessionReward(secondReward, () => 0.99, 'second-roll'),
      8_000,
      'second-continue',
    );

    expect(completed.status).toBe('completed');
    expect(didCrossPhaseBoundary(finalBonus, completed)).toBe(true);
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
