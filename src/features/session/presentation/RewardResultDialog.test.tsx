import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { RewardResultDialog } from './RewardResultDialog';

describe('RewardResultDialog', () => {
  test('presents and dismisses a Reward accessibly', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <RewardResultDialog
        reward={{
          icon: '☕',
          title: 'Tea',
          description: 'Make a warm cup.',
          probability: 1,
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
    ).toHaveTextContent('Tea');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
