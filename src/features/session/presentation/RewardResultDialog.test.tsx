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

const rerollDice = createWorkflow({
  id: 'workflow-rerolls',
  name: 'Rewarded work',
  phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
  rewardDice: {
    frequency: 1,
    rerolls: 2,
    sides: [
      { icon: '☕', title: 'Tea' },
      { icon: '🌿', title: 'Fresh air' },
    ],
  },
}).rewardDice;

if (rerollDice === undefined) {
  throw new Error('Expected reroll Reward Dice fixture.');
}

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
    expect(screen.getByRole('dialog', { name: 'Reward unlocked' })).toHaveClass(
      'dialog--reward',
    );
    expect(screen.getByTestId('reward-cube').parentElement).toHaveClass(
      'reward-dialog__content',
    );
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

    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));

    expect(random).toHaveBeenCalledOnce();
    expect(onRoll).toHaveBeenCalledWith(2_500);
    expect(screen.getByTestId('reward-cube')).toHaveAttribute(
      'data-state',
      'mixing',
    );
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeDisabled();
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
    expect(
      screen.queryByRole('button', { name: /Roll again/ }),
    ).not.toBeInTheDocument();
  });

  test('replaces the result until the configured rerolls are exhausted', () => {
    vi.useFakeTimers();
    const random = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0);
    const onRoll = vi.fn();
    render(
      <RewardResultDialog
        dice={rerollDice}
        random={random}
        reducedMotion
        onRoll={onRoll}
        onContinue={() => Promise.resolve()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText('Tea')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Roll again · 2 left' }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Roll again · 2 left' }),
    );
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    ).toBeDisabled();
    expect(onRoll).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText('Fresh air')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText('Tea')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Roll again/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
    expect(random).toHaveBeenCalledTimes(3);
    expect(onRoll).toHaveBeenCalledTimes(3);
    expect(onRoll).toHaveBeenNthCalledWith(3, 600);
  });

  test('keeps keyboard focus on the reroll action while its result is mixing', () => {
    vi.useFakeTimers();
    render(
      <RewardResultDialog
        dice={rerollDice}
        random={() => 0}
        reducedMotion
        onRoll={vi.fn()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const reroll = screen.getByRole('button', {
      name: 'Roll again · 2 left',
    });
    reroll.focus();

    fireEvent.click(reroll);

    const mixingReroll = screen.getByRole('button', {
      name: 'Roll again · 1 left',
    });
    expect(mixingReroll).toBeDisabled();
    expect(mixingReroll).toHaveFocus();
  });

  test('announces a replacement Reward as an atomic polite status', () => {
    vi.useFakeTimers();
    const random = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.75);
    render(
      <RewardResultDialog
        dice={rerollDice}
        random={random}
        reducedMotion
        onRoll={vi.fn()}
        onContinue={() => Promise.resolve()}
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

    expect(screen.getByRole('status')).toHaveTextContent('Fresh air');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  });

  test('moves focus to Continue after the final reroll is revealed', () => {
    vi.useFakeTimers();
    render(
      <RewardResultDialog
        dice={rerollDice}
        random={() => 0}
        reducedMotion
        onRoll={vi.fn()}
        onContinue={() => Promise.resolve()}
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
    const finalReroll = screen.getByRole('button', {
      name: 'Roll again · 1 left',
    });
    finalReroll.focus();
    fireEvent.click(finalReroll);
    const mixingFinalReroll = screen.getByRole('button', {
      name: 'Roll again · 1 left',
    });
    expect(mixingFinalReroll).toBeDisabled();
    expect(mixingFinalReroll).toHaveFocus();
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
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

    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
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
