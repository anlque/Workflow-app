import { act, fireEvent, render, screen } from '@testing-library/react';
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
      93_000,
    );
    render(
      <ActiveSessionView session={completed} now={() => 93_000} {...actions} />,
    );

    expect(screen.getByText('Session complete')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();
  });

  test('requests one bell for an authoritative Phase transition', () => {
    const initial = createSession('session-1', workflow, 1_000);
    const phaseTwo = deriveSessionState(initial, 61_000);
    const onPhaseBoundary = vi.fn();
    const { rerender } = render(
      <ActiveSessionView
        session={initial}
        now={() => 1_000}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );

    rerender(
      <ActiveSessionView
        session={phaseTwo}
        now={() => 61_000}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );
    expect(onPhaseBoundary).toHaveBeenCalledOnce();

    rerender(
      <ActiveSessionView
        session={phaseTwo}
        now={() => 61_000}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );
    expect(onPhaseBoundary).toHaveBeenCalledOnce();
  });

  test('softens the timer and removes controls during the transition', () => {
    const transitioning = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      61_000,
    );

    render(
      <ActiveSessionView
        session={transitioning}
        now={() => 61_000}
        {...actions}
      />,
    );

    expect(screen.getByText('Transitioning to the next phase…')).toBeVisible();
    expect(screen.getByLabelText('Time remaining')).toHaveAttribute(
      'data-transitioning',
      'true',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('shows an eligible Reward only after an authoritative transition', () => {
    vi.useFakeTimers();
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
    const onRewardRoll = vi.fn();
    const continueReward = vi.fn(() => Promise.resolve());
    const random = vi.fn(() => 0);
    const { rerender } = render(
      <ActiveSessionView
        session={initial}
        now={() => 1_500}
        random={random}
        reducedMotion
        rewardInteraction={{ onRoll: onRewardRoll, continueReward }}
        {...actions}
      />,
    );
    expect(
      screen.queryByRole('dialog', { name: 'Reward unlocked' }),
    ).not.toBeInTheDocument();

    rerender(
      <ActiveSessionView
        session={deriveSessionState(initial, 3_000)}
        now={() => 3_000}
        random={random}
        reducedMotion
        rewardInteraction={{ onRoll: onRewardRoll, continueReward }}
        {...actions}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
    ).toBeVisible();
    expect(random).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    expect(random).toHaveBeenCalledOnce();
    expect(onRewardRoll).toHaveBeenCalledWith(600);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText('Tea')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(continueReward).toHaveBeenCalledWith(initial.id);
    vi.useRealTimers();
  });
});
