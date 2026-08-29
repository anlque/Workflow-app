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
        draft={{
          enabled: false,
          triggerPhaseType: 'focus',
          frequency: '1',
          rerolls: '0',
          sides: [],
        }}
        errors={{}}
        onEnabledChange={onEnabledChange}
        onTriggerPhaseTypeChange={() => undefined}
        onFrequencyChange={() => undefined}
        onRerollsChange={() => undefined}
        onSideChange={() => undefined}
        onAddSide={() => undefined}
        onRemoveSide={() => undefined}
      />,
    );

    expect(screen.queryByLabelText('Reward frequency')).toBeNull();
    await user.click(screen.getByLabelText('Enable Reward Dice'));
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  test('disables side removal when two sides remain', () => {
    render(
      <RewardDiceEditor
        draft={{
          enabled: true,
          triggerPhaseType: 'focus',
          frequency: '1',
          rerolls: '0',
          sides: [
            {
              key: 'tea',
              icon: '☕',
              title: 'Tea',
              description: '',
              weight: '',
            },
            {
              key: 'walk',
              icon: '🚶',
              title: 'Walk',
              description: '',
              weight: '',
            },
          ],
        }}
        errors={{}}
        onEnabledChange={() => undefined}
        onTriggerPhaseTypeChange={() => undefined}
        onFrequencyChange={() => undefined}
        onRerollsChange={() => undefined}
        onSideChange={() => undefined}
        onAddSide={() => undefined}
        onRemoveSide={() => undefined}
      />,
    );

    const removeButtons = screen.getAllByRole('button', {
      name: /Remove reward side/,
    });
    expect(removeButtons).toHaveLength(2);
    for (const button of removeButtons) expect(button).toBeDisabled();
    expect(
      screen.getByText('A Reward Dice needs at least two sides.'),
    ).toBeVisible();
  });

  test('selects the phase type used for Reward Dice cadence', async () => {
    const user = userEvent.setup();
    const onTriggerPhaseTypeChange = vi.fn();
    render(
      <RewardDiceEditor
        draft={{
          enabled: true,
          triggerPhaseType: 'focus',
          frequency: '1',
          rerolls: '0',
          sides: [],
        }}
        errors={{}}
        onEnabledChange={() => undefined}
        onTriggerPhaseTypeChange={onTriggerPhaseTypeChange}
        onFrequencyChange={() => undefined}
        onRerollsChange={() => undefined}
        onSideChange={() => undefined}
        onAddSide={() => undefined}
        onRemoveSide={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Reward after')).toHaveValue('focus');
    expect(
      screen.getByText('Completed focus phases between rolls.'),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Reward after'), 'break');

    expect(onTriggerPhaseTypeChange).toHaveBeenCalledWith('break');
  });

  test('selects the number of additional rolls', async () => {
    const user = userEvent.setup();
    const onRerollsChange = vi.fn();
    render(
      <RewardDiceEditor
        draft={{
          enabled: true,
          triggerPhaseType: 'focus',
          frequency: '1',
          rerolls: '0',
          sides: [],
        }}
        errors={{ 'reward:rerolls': 'Choose between 0 and 3 rerolls.' }}
        onEnabledChange={() => undefined}
        onTriggerPhaseTypeChange={() => undefined}
        onFrequencyChange={() => undefined}
        onRerollsChange={onRerollsChange}
        onSideChange={() => undefined}
        onAddSide={() => undefined}
        onRemoveSide={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Available rerolls')).toHaveValue('0');
    expect(
      screen.getByText('Additional rolls available after the first roll.'),
    ).toBeVisible();
    expect(screen.getByText('Choose between 0 and 3 rerolls.')).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Available rerolls'), '3');

    expect(onRerollsChange).toHaveBeenCalledWith('3');
  });
});
