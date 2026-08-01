import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { rewardsForSessionTransition } from './rewardTransitions';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    { type: 'focus', durationSeconds: 1, environment: {} },
    { type: 'break', durationSeconds: 1, environment: {} },
    { type: 'focus', durationSeconds: 1, environment: {} },
    { type: 'focus', durationSeconds: 1, environment: {} },
  ],
  rewardDice: {
    frequency: 2,
    sides: [
      { icon: '☕', title: 'Tea', weight: 1 },
      { icon: '🌿', title: 'Fresh air', weight: 1 },
    ],
  },
});

describe('rewardsForSessionTransition', () => {
  test('does not replay a Reward on initial hydration', () => {
    const current = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      4_000,
    );
    expect(rewardsForSessionTransition(null, current, () => 0)).toEqual([]);
  });

  test('counts only completed focus Phases and honors frequency', () => {
    const initial = createSession('session-1', workflow, 1_000);
    const afterBreak = deriveSessionState(initial, 3_000);
    const afterSecondFocus = deriveSessionState(initial, 4_000);

    expect(rewardsForSessionTransition(initial, afterBreak, () => 0)).toEqual(
      [],
    );
    expect(
      rewardsForSessionTransition(afterBreak, afterSecondFocus, () => 0)[0]
        ?.title,
    ).toBe('Tea');
  });

  test('handles late transitions across multiple Phases with injected randomness', () => {
    const random = vi.fn().mockReturnValueOnce(0.75);
    const initial = createSession('session-1', workflow, 1_000);
    const completed = deriveSessionState(initial, 5_000);

    expect(
      rewardsForSessionTransition(initial, completed, random).map(
        ({ title }) => title,
      ),
    ).toEqual(['Fresh air']);
    expect(random).toHaveBeenCalledOnce();
  });

  test('ignores replacement with a different Session', () => {
    const first = createSession('session-1', workflow, 1_000);
    const second = deriveSessionState(
      createSession('session-2', workflow, 1_000),
      5_000,
    );
    expect(rewardsForSessionTransition(first, second, () => 0)).toEqual([]);
  });
});
