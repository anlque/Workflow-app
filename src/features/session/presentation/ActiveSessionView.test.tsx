import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession, rollSessionReward } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { ActiveSessionView } from './ActiveSessionView';

const actions = {
  onPause: vi.fn(() => Promise.resolve()),
  onResume: vi.fn(() => Promise.resolve()),
  onStop: vi.fn(() => Promise.resolve()),
};

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    { type: 'focus', durationSeconds: 1, environment: {} },
    { type: 'break', durationSeconds: 1, environment: {} },
  ],
  rewardDice: {
    frequency: 1,
    rerolls: 1,
    sides: [
      { icon: '☕', title: 'Tea' },
      { icon: '🌿', title: 'Fresh air' },
    ],
  },
});

function interaction() {
  return {
    onRoll: vi.fn(),
    rollReward: vi.fn(() => Promise.resolve()),
    rerollReward: vi.fn(() => Promise.resolve()),
    continueReward: vi.fn(() => Promise.resolve()),
  };
}

describe('ActiveSessionView', () => {
  test('shows phase and anchor-derived countdown', () => {
    render(
      <ActiveSessionView
        session={createSession('session-1', workflow, 1_000)}
        now={() => 1_250}
        {...actions}
      />,
    );
    expect(screen.getByText('Focus · Phase 1 of 2')).toBeVisible();
    expect(screen.getByText('00:01')).toBeVisible();
  });

  test('renders authoritative Reward state after remount', () => {
    const paused = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );
    const rolled = rollSessionReward(paused, () => 0);
    const callbacks = interaction();
    const first = render(
      <ActiveSessionView
        session={rolled}
        rewardInteraction={callbacks}
        {...actions}
      />,
    );
    expect(screen.getByText('Tea')).toBeVisible();
    first.unmount();
    render(
      <ActiveSessionView
        session={rolled}
        rewardInteraction={callbacks}
        {...actions}
      />,
    );
    expect(screen.getByText('Tea')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    ).toBeVisible();
  });

  test('requests authoritative roll and continue commands', () => {
    const paused = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );
    const callbacks = interaction();
    render(
      <ActiveSessionView
        session={paused}
        rewardInteraction={callbacks}
        {...actions}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    expect(callbacks.rollReward).toHaveBeenCalledWith(paused.id);
  });

  test('requests authoritative Continue for a hydrated result', () => {
    const paused = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );
    const rolled = rollSessionReward(paused, () => 0, 'roll-1');
    const callbacks = interaction();
    render(
      <ActiveSessionView
        session={rolled}
        rewardInteraction={callbacks}
        {...actions}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(callbacks.continueReward).toHaveBeenCalledWith(paused.id);
  });

  test('keeps a final Reward visible before acknowledgment', () => {
    const finalWorkflow = createWorkflow({
      ...workflow,
      id: 'workflow-final',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
    });
    const paused = deriveSessionState(
      createSession('session-final', finalWorkflow, 1_000),
      3_000,
    );
    render(
      <ActiveSessionView
        session={paused}
        rewardInteraction={interaction()}
        {...actions}
      />,
    );
    expect(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
    ).toBeVisible();
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument();
  });
});
