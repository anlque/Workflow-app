import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { RewardResultDialog } from './RewardResultDialog';

const dice = createWorkflow({
  id: 'workflow-1',
  name: 'Rewarded work',
  phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
  rewardDice: {
    frequency: 1,
    sides: [
      { icon: '☕', title: 'Tea', description: 'Make a warm cup.' },
      { icon: '🌿', title: 'Fresh air' },
    ],
  },
}).rewardDice;

if (dice === undefined) throw new Error('Expected Reward Dice fixture.');

afterEach(() => {
  vi.useRealTimers();
});

describe('RewardResultDialog', () => {
  test('waits for Roll before selecting a Reward', () => {
    const random = vi.fn(() => 0);
    const onRoll = vi.fn();
    render(
      <RewardResultDialog
        dice={dice}
        random={random}
        reducedMotion={false}
        onRoll={onRoll}
        onContinue={() => Promise.resolve()}
      />,
    );

    expect(screen.getByTestId('reward-cube')).toHaveAttribute(
      'data-state',
      'ready',
    );
    expect(random).not.toHaveBeenCalled();
    expect(onRoll).not.toHaveBeenCalled();
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();
  });

  test('mixes for 2.5 seconds and reveals the selected Reward', () => {
    vi.useFakeTimers();
    const random = vi.fn(() => 0);
    const onRoll = vi.fn();
    render(
      <RewardResultDialog
        dice={dice}
        random={random}
        reducedMotion={false}
        onRoll={onRoll}
        onContinue={() => Promise.resolve()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));

    expect(random).toHaveBeenCalledOnce();
    expect(onRoll).toHaveBeenCalledWith(2_500);
    expect(screen.getByTestId('reward-cube')).toHaveAttribute(
      'data-state',
      'mixing',
    );
    expect(screen.getByRole('button', { name: 'Roll' })).toBeDisabled();
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_500);
    });

    expect(screen.getByTestId('reward-cube')).toHaveAttribute(
      'data-state',
      'result',
    );
    expect(screen.getByText('Tea')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('uses a 600 ms sound window and no visual roll with reduced motion', () => {
    vi.useFakeTimers();
    const onRoll = vi.fn();
    render(
      <RewardResultDialog
        dice={dice}
        random={() => 0.75}
        reducedMotion
        onRoll={onRoll}
        onContinue={() => Promise.resolve()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));

    expect(onRoll).toHaveBeenCalledWith(600);
    expect(screen.getByTestId('reward-cube')).toHaveAttribute(
      'data-state',
      'mixing-reduced',
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText('Fresh air')).toBeVisible();
  });

  test('cannot be dismissed with Escape', () => {
    render(
      <RewardResultDialog
        dice={dice}
        random={() => 0}
        reducedMotion={false}
        onRoll={vi.fn()}
        onContinue={() => Promise.resolve()}
      />,
    );

    fireEvent(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
      new Event('cancel', { cancelable: true }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
    ).toBeVisible();
  });

  test('keeps the result open and reports a continuation failure', async () => {
    vi.useFakeTimers();
    render(
      <RewardResultDialog
        dice={dice}
        random={() => 0}
        reducedMotion
        onRoll={vi.fn()}
        onContinue={() => Promise.reject(new Error('Background unavailable.'))}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Background unavailable.',
    );
    expect(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
    ).toBeVisible();
  });
});
