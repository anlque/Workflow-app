import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { ActiveSessionView } from './ActiveSessionView';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    { type: 'focus', durationSeconds: 60, environment: {} },
    { type: 'break', durationSeconds: 30, environment: {} },
  ],
});

const actions = {
  onPause: vi.fn(() => Promise.resolve()),
  onResume: vi.fn(() => Promise.resolve()),
  onStop: vi.fn(() => Promise.resolve()),
};

describe('ActiveSessionView', () => {
  test('shows Workflow, phase position and an anchor-derived countdown', () => {
    render(
      <ActiveSessionView
        session={createSession('session-1', workflow, 1_000)}
        now={() => 11_000}
        {...actions}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Deep work' })).toBeVisible();
    expect(screen.getByText('Focus · Phase 1 of 2')).toBeVisible();
    expect(screen.getByText('00:50')).toBeVisible();
  });

  test('renders a terminal summary without controls', () => {
    const completed = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      91_000,
    );
    render(
      <ActiveSessionView session={completed} now={() => 91_000} {...actions} />,
    );

    expect(screen.getByText('Session complete')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();
  });

  test('shows an eligible Reward only after an authoritative transition', () => {
    const rewardedWorkflow = createWorkflow({
      id: 'rewarded',
      name: 'Rewarded focus',
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
    const initial = createSession('session-reward', rewardedWorkflow, 1_000);
    const { rerender } = render(
      <ActiveSessionView
        session={initial}
        now={() => 1_500}
        random={() => 0}
        reducedMotion
        {...actions}
      />,
    );
    expect(
      screen.queryByRole('dialog', { name: 'Reward unlocked' }),
    ).not.toBeInTheDocument();

    rerender(
      <ActiveSessionView
        session={deriveSessionState(initial, 2_000)}
        now={() => 2_000}
        random={() => 0}
        reducedMotion
        {...actions}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
    ).toHaveTextContent('Tea');
  });
});
