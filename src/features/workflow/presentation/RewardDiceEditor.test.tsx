import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { RewardDiceEditor } from './RewardDiceEditor';

describe('RewardDiceEditor', () => {
  test('keeps optional reward controls hidden until enabled', async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();
    render(
      <RewardDiceEditor
        draft={{ enabled: false, frequency: '1', sides: [] }}
        errors={{}}
        onEnabledChange={onEnabledChange}
        onFrequencyChange={() => undefined}
        onSideChange={() => undefined}
        onAddSide={() => undefined}
        onRemoveSide={() => undefined}
      />,
    );

    expect(screen.queryByLabelText('Reward frequency')).toBeNull();
    await user.click(screen.getByLabelText('Enable Reward Dice'));
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });
});
