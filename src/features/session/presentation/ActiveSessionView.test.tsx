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

  test('softens the complete Session card and removes controls during the transition', () => {
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
    expect(
      screen.getByRole('heading', { name: 'Deep work' }).closest('section'),
    ).toHaveAttribute('data-transitioning', 'true');
    expect(screen.getByLabelText('Time remaining')).not.toHaveAttribute(
      'data-transitioning',
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

    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
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

  test('reveals final completion before requesting its delayed cue', () => {
    vi.useFakeTimers();
    const rewardedWorkflow = createWorkflow({
      id: 'final-reward',
      name: 'Final reward',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const completed = deriveSessionState(
      createSession('session-final', rewardedWorkflow, 1_000),
      3_000,
    );
    const onFinalRewardContinued = vi.fn();

    const initial = createSession('session-final', rewardedWorkflow, 1_000);
    const { rerender } = render(
      <ActiveSessionView
        session={initial}
        now={() => 1_000}
        random={() => 0}
        reducedMotion
        rewardInteraction={{
          onRoll: vi.fn(),
          continueReward: vi.fn(() => Promise.resolve()),
        }}
        onFinalRewardContinued={onFinalRewardContinued}
        {...actions}
      />,
    );

    rerender(
      <ActiveSessionView
        session={completed}
        now={() => 3_000}
        random={() => 0}
        reducedMotion
        rewardInteraction={{
          onRoll: vi.fn(),
          continueReward: vi.fn(() => Promise.resolve()),
        }}
        onFinalRewardContinued={onFinalRewardContinued}
        {...actions}
      />,
    );

    expect(screen.queryByText('Session complete')).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.queryByRole('dialog', { name: 'Reward unlocked' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Session complete')).toBeVisible();
    expect(onFinalRewardContinued).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  test('starts each Session Reward with fresh result and reroll state', () => {
    vi.useFakeTimers();
    const rewardedWorkflow = createWorkflow({
      id: 'session-reward-lifecycle',
      name: 'Session reward lifecycle',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        rerolls: 2,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const sessionA = createSession('session-a', rewardedWorkflow, 1_000);
    const sessionB = createSession('session-b', rewardedWorkflow, 4_000);
    const rewardInteraction = {
      onRoll: vi.fn(),
      continueReward: vi.fn(() => Promise.resolve()),
    };
    const random = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0);
    const { rerender } = render(
      <ActiveSessionView
        session={sessionA}
        now={() => 1_000}
        random={random}
        reducedMotion
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );

    rerender(
      <ActiveSessionView
        session={deriveSessionState(sessionA, 3_000)}
        now={() => 3_000}
        random={random}
        reducedMotion
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll again · 2 left' }),
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText('Fresh air')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    ).toBeVisible();

    rerender(
      <ActiveSessionView
        session={sessionB}
        now={() => 4_000}
        random={random}
        reducedMotion
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );
    expect(
      screen.queryByRole('dialog', { name: 'Reward unlocked' }),
    ).not.toBeInTheDocument();

    rerender(
      <ActiveSessionView
        session={deriveSessionState(sessionB, 6_000)}
        now={() => 6_000}
        random={random}
        reducedMotion
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeVisible();
    expect(screen.queryByText('Fresh air')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(
      screen.getByRole('button', { name: 'Roll again · 2 left' }),
    ).toBeVisible();
    vi.useRealTimers();
  });

  test('hydrates a different reward-paused Session with a fresh Reward opportunity', () => {
    vi.useFakeTimers();
    const rewardedWorkflow = createWorkflow({
      id: 'hydrated-reward',
      name: 'Hydrated reward',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        rerolls: 2,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const sessionA = createSession('hydration-a', rewardedWorkflow, 1_000);
    const sessionB = createSession('hydration-b', rewardedWorkflow, 4_000);
    const rewardInteraction = {
      onRoll: vi.fn(),
      continueReward: vi.fn(() => Promise.resolve()),
    };
    const random = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0);
    const { rerender } = render(
      <ActiveSessionView
        session={sessionA}
        now={() => 1_000}
        random={random}
        reducedMotion
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );
    rerender(
      <ActiveSessionView
        session={deriveSessionState(sessionA, 3_000)}
        now={() => 3_000}
        random={random}
        reducedMotion
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll again · 2 left' }),
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText('Fresh air')).toBeVisible();

    rerender(
      <ActiveSessionView
        session={deriveSessionState(sessionB, 6_000)}
        now={() => 6_000}
        random={random}
        reducedMotion
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );

    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeVisible();
    expect(screen.queryByText('Fresh air')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(
      screen.getByRole('button', { name: 'Roll again · 2 left' }),
    ).toBeVisible();
    vi.useRealTimers();
  });

  test('does not replay a final Reward when switching to an already-completed Session', () => {
    const rewardedWorkflow = createWorkflow({
      id: 'transient-final-reward',
      name: 'Transient final reward',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const sessionA = createSession('final-switch-a', rewardedWorkflow, 1_000);
    const sessionB = createSession('final-switch-b', rewardedWorkflow, 4_000);
    const rewardInteraction = {
      onRoll: vi.fn(),
      continueReward: vi.fn(() => Promise.resolve()),
    };
    const { rerender } = render(
      <ActiveSessionView
        session={sessionA}
        now={() => 1_000}
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );

    rerender(
      <ActiveSessionView
        session={deriveSessionState(sessionB, 6_000)}
        now={() => 6_000}
        rewardInteraction={rewardInteraction}
        {...actions}
      />,
    );

    expect(screen.getByText('Session complete')).toBeVisible();
    expect(
      screen.queryByRole('dialog', { name: 'Reward unlocked' }),
    ).not.toBeInTheDocument();
  });
});
