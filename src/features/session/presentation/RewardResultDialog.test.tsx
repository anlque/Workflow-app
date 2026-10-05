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
const otherSide = createWorkflow({
  id: 'workflow-2',
  name: 'Another reward',
  phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
  rewardDice: {
    frequency: 1,
    sides: [
      { icon: '🌿', title: 'Fresh air' },
      { icon: '☕', title: 'Tea' },
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
    expect(screen.getByRole('status')).not.toHaveAttribute('data-animate');
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
      'rolling',
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

  test('waits for command, authoritative projection and ended before announcing the result', async () => {
    const onRoll = vi.fn();
    const { rerender } = render(
      <RewardResultDialog
        reward={null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={onRoll}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    rerender(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={onRoll}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    expect(onRoll).toHaveBeenCalledWith(3_000);
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();
    fireEvent.ended(screen.getByTestId('reward-dice-video'));
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('status')).toHaveAttribute('data-animate', 'true');
    expect(screen.getByTestId('reward-dice-video')).toBeVisible();
  });

  test('waits for a delayed command after media ends', async () => {
    let resolveCommand: (() => void) | undefined;
    const requestRoll = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCommand = resolve;
        }),
    );
    const { rerender } = render(
      <RewardResultDialog
        reward={null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={requestRoll}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    fireEvent.ended(screen.getByTestId('reward-dice-video'));
    rerender(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={requestRoll}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();

    await act(async () => {
      resolveCommand?.();
      await Promise.resolve();
    });
    expect(screen.getByText('Tea')).toBeVisible();
  });

  test('does not reveal the previous reward while a reroll awaits its fresh projection', async () => {
    const { rerender } = render(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={0}
        rerolls={1}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    );
    fireEvent.ended(screen.getByTestId('reward-dice-video'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();

    rerender(
      <RewardResultDialog
        reward={otherSide ?? null}
        usedRerolls={1}
        rerolls={1}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    expect(await screen.findByText('Fresh air')).toBeVisible();
  });

  test('stops presentation sound on command failure and unmount without double stop', async () => {
    const stop = vi.fn();
    const { unmount } = render(
      <RewardResultDialog
        reward={null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={() => ({ stop })}
        requestRoll={() => Promise.reject(new Error('Storage failed.'))}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage failed.',
    );
    expect(stop).toHaveBeenCalledOnce();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });

  test.each([
    { kind: 'roll', outcome: 'resolve' },
    { kind: 'roll', outcome: 'reject' },
    { kind: 'reroll', outcome: 'resolve' },
    { kind: 'reroll', outcome: 'reject' },
  ] as const)(
    'invalidates a pending $kind command before unmount cleanup when it later $outcome',
    async ({ kind, outcome }) => {
      let settleCommand: (() => void) | undefined;
      const requestCommand = vi.fn(
        () =>
          new Promise<void>((resolve, reject) => {
            settleCommand = () => {
              if (outcome === 'resolve') resolve();
              else reject(new Error('Late failure.'));
            };
          }),
      );
      const stop = vi.fn();
      const { unmount } = render(
        <RewardResultDialog
          reward={kind === 'reroll' ? (side ?? null) : null}
          usedRerolls={0}
          rerolls={kind === 'reroll' ? 1 : 0}
          reducedMotion={false}
          onRoll={() => ({ stop })}
          requestRoll={kind === 'roll' ? requestCommand : vi.fn()}
          requestReroll={kind === 'reroll' ? requestCommand : vi.fn()}
          onContinue={() => Promise.resolve()}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: kind === 'roll' ? 'Roll dice' : 'Roll again · 1 left',
        }),
      );
      unmount();
      await act(async () => {
        settleCommand?.();
        await Promise.resolve();
      });

      expect(stop).toHaveBeenCalledOnce();
    },
  );

  test('ignores Escape and keeps the authoritative ritual open', () => {
    render(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  test('reports Continue failure and restores the actionable control', async () => {
    render(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={0}
        rerolls={0}
        reducedMotion={false}
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.reject(new Error('Continue failed.'))}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Continue failed.',
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  test('moves focus to Continue after the last reroll animation', async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={0}
        rerolls={1}
        reducedMotion
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    rerender(
      <RewardResultDialog
        reward={side ?? null}
        usedRerolls={1}
        rerolls={1}
        reducedMotion
        onRoll={vi.fn()}
        requestRoll={() => Promise.resolve()}
        requestReroll={() => Promise.resolve()}
        onContinue={() => Promise.resolve()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
  });
});
