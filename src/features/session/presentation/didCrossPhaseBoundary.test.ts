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
});
