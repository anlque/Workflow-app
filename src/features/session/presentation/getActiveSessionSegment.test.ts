import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  rollSessionReward,
} from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { getActiveSessionSegment } from './getActiveSessionSegment';

describe('getActiveSessionSegment', () => {
  test('projects the selected Bonus without changing the normal Phase index', () => {
    const workflow = createWorkflow({
      id: 'segment-workflow',
      name: 'Segment',
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
              name: 'Tea break',
              durationSeconds: 30,
              environment: { backgroundColor: '#123456' },
            },
          },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const paused = deriveSessionState(
      createSession('segment-session', workflow, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(paused, () => 0),
      4_000,
      'continue-segment',
    );

    expect(getActiveSessionSegment(bonus)).toEqual({
      isBonus: true,
      label: 'Tea break',
      environment: { backgroundColor: '#123456' },
    });
    expect(bonus.currentPhaseIndex).toBe(1);
  });

  test('projects an ordinary Phase when no Bonus is active', () => {
    const session = createSession(
      'ordinary-session',
      createWorkflow({
        id: 'ordinary-workflow',
        name: 'Ordinary',
        phases: [
          {
            type: 'focus',
            durationSeconds: 10,
            environment: { backgroundColor: '#abcdef' },
          },
        ],
      }),
      1_000,
    );
    expect(getActiveSessionSegment(session)).toEqual({
      isBonus: false,
      label: 'Focus · Phase 1 of 1',
      environment: { backgroundColor: '#abcdef' },
    });
  });
});
