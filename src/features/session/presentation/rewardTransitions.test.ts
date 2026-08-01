import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { rewardOpportunityForSessionTransition } from './rewardTransitions';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    { type: 'focus', durationSeconds: 1, environment: {} },
    { type: 'break', durationSeconds: 1, environment: {} },
  ],
  rewardDice: {
    frequency: 1,
    sides: [
      { icon: '☕', title: 'Tea' },
      { icon: '🌿', title: 'Fresh air' },
    ],
  },
});

describe('rewardOpportunityForSessionTransition', () => {
  test('restores an initially hydrated Reward pause', () => {
    const rewardPaused = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );

    expect(rewardOpportunityForSessionTransition(null, rewardPaused)).toEqual(
      workflow.rewardDice,
    );
  });

  test('reports one newly observed Reward pause without selecting a side', () => {
    const initial = createSession('session-1', workflow, 1_000);
    const rewardPaused = deriveSessionState(initial, 3_000);

    expect(
      rewardOpportunityForSessionTransition(initial, rewardPaused),
    ).toEqual(workflow.rewardDice);
    expect(
      rewardOpportunityForSessionTransition(rewardPaused, rewardPaused),
    ).toBeNull();
  });

  test('reports an eligible final completion once', () => {
    const finalWorkflow = createWorkflow({
      id: 'workflow-final',
      name: 'Final focus',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const initial = createSession('session-1', finalWorkflow, 1_000);
    const completed = deriveSessionState(initial, 3_000);

    expect(rewardOpportunityForSessionTransition(initial, completed)).toEqual(
      finalWorkflow.rewardDice,
    );
    expect(
      rewardOpportunityForSessionTransition(completed, completed),
    ).toBeNull();
  });

  test('ignores unrelated and ineligible transitions', () => {
    const initial = createSession('session-1', workflow, 1_000);
    const transitioning = deriveSessionState(initial, 2_000);
    const another = deriveSessionState(
      createSession('session-2', workflow, 1_000),
      3_000,
    );

    expect(
      rewardOpportunityForSessionTransition(initial, transitioning),
    ).toBeNull();
    expect(rewardOpportunityForSessionTransition(initial, another)).toBeNull();
  });

  test('reports a reward only after the configured break boundary', () => {
    const breakWorkflow = createWorkflow({
      id: 'workflow-break',
      name: 'Focus and recover',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
        { type: 'focus', durationSeconds: 1, environment: {} },
      ],
      rewardDice: {
        triggerPhaseType: 'break',
        frequency: 1,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const initial = createSession('session-break', breakWorkflow, 1_000);
    const afterFocus = deriveSessionState(initial, 3_000);
    const afterBreak = deriveSessionState(initial, 5_000);

    expect(
      rewardOpportunityForSessionTransition(initial, afterFocus),
    ).toBeNull();
    expect(
      rewardOpportunityForSessionTransition(afterFocus, afterBreak),
    ).toEqual(breakWorkflow.rewardDice);
  });
});
