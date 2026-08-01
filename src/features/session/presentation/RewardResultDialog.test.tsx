import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { RewardResultDialog } from './RewardResultDialog';

describe('RewardResultDialog', () => {
  test('reveals and dismisses a Reward after the cube settles', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <RewardResultDialog
        reward={{
          icon: '☕',
          title: 'Tea',
          description: 'Make a warm cup.',
          probability: 1,
        }}
        reducedMotion={false}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByTestId('reward-cube')).toHaveAttribute(
      'data-state',
      'rolling',
    );
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1_200);
    });
    expect(screen.getByText('Tea')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  test('reveals the Reward immediately with reduced motion', () => {
    render(
      <RewardResultDialog
        reward={{
          icon: '☕',
          title: 'Tea',
          description: 'Make a warm cup.',
          probability: 1,
        }}
        reducedMotion
        onDismiss={() => undefined}
      />,
    );

    expect(screen.getByTestId('reward-cube')).toHaveAttribute(
      'data-state',
      'settled',
    );
    expect(screen.getByText('Tea')).toBeVisible();
  });

  test('settles an in-progress cube when reduced motion becomes active', () => {
    const reward = {
      icon: '☕',
      title: 'Tea',
      probability: 1,
    } as const;
    const { rerender } = render(
      <RewardResultDialog
        reward={reward}
        reducedMotion={false}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.queryByText('Tea')).not.toBeInTheDocument();

    rerender(
      <RewardResultDialog
        reward={reward}
        reducedMotion
        onDismiss={() => undefined}
      />,
    );

    expect(screen.getByText('Tea')).toBeVisible();
  });
});
