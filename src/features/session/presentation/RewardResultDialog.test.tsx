import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { RewardResultDialog } from './RewardResultDialog';

const side = createWorkflow({
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
}).rewardDice?.sides[0];

afterEach(() => vi.useRealTimers());

describe('RewardResultDialog', () => {
  test('requests an authoritative roll without selecting locally', () => {
    const requestRoll = vi.fn(() => Promise.resolve());
    render(
      <RewardResultDialog
        reward={null}
        usedRerolls={0}
        rerolls={1}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={requestRoll}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    expect(requestRoll).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();
  });

  test('hydrates an existing result immediately after remount', () => {
    render(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={1}
        rerolls={2}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    expect(screen.getByText('Tea')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    ).toBeVisible();
  });

  test('keeps animation local while requesting an authoritative reroll', () => {
    vi.useFakeTimers();
    const requestReroll = vi.fn(() => Promise.resolve());
    render(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={0}
        rerolls={1}
        reducedMotion
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={requestReroll}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    );
    expect(requestReroll).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('reward-cube')).toHaveAttribute(
      'data-state',
      'mixing-reduced',
    );
    void act(() => vi.advanceTimersByTime(600));
  });

  test('shows command failures without dismissing the ritual', async () => {
    render(
      <RewardResultDialog
        reward={null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={() => Promise.reject(new Error('Storage failed.'))}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage failed.',
    );
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeEnabled();
  });

  test('keeps Continue pending and prevents duplicate acknowledgment', async () => {
    let resolveContinue: (() => void) | undefined;
    const onContinue = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveContinue = resolve;
        }),
    );
    render(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={onContinue}
      />,
    );
    const button = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Continuing…' })).toBeDisabled();
    await act(async () => {
      resolveContinue?.();
      await Promise.resolve();
    });
  });

  test('moves focus to Continue when the final reroll is exhausted', () => {
    render(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={1}
        rerolls={1}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
  });
});
