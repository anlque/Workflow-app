import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { RewardDiceEditor } from './RewardDiceEditor';
import type { RewardSideDraft } from './useWorkflowEditor';

describe('RewardDiceEditor', () => {
  test('keeps optional reward controls hidden until enabled', async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();
    render(
      <RewardDiceEditor
        assets={[]}
        draft={{
          enabled: false,
          scheduleMode: 'frequency',
          triggerPhaseType: 'focus',
          frequency: '1',
          customPhaseKeys: [],
          rerolls: '0',
          sides: [],
        }}
        errors={{}}
        onEnabledChange={onEnabledChange}
        onScheduleModeChange={() => undefined}
        onTriggerPhaseTypeChange={() => undefined}
        onFrequencyChange={() => undefined}
        onRerollsChange={() => undefined}
        onSideChange={() => undefined}
        onBonusDurationChange={() => undefined}
        onBonusDurationCommit={() => undefined}
        onBonusDurationStep={() => undefined}
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
        assets={[]}
        draft={{
          enabled: true,
          scheduleMode: 'frequency',
          triggerPhaseType: 'focus',
          frequency: '1',
          customPhaseKeys: [],
          rerolls: '0',
          sides: [
            {
              key: 'tea',
              icon: '☕',
              title: 'Tea',
              description: '',
              weight: '',
              availability: 'any',
            },
            {
              key: 'walk',
              icon: '🚶',
              title: 'Walk',
              description: '',
              weight: '',
              availability: 'any',
            },
          ],
        }}
        errors={{}}
        onEnabledChange={() => undefined}
        onScheduleModeChange={() => undefined}
        onTriggerPhaseTypeChange={() => undefined}
        onFrequencyChange={() => undefined}
        onRerollsChange={() => undefined}
        onSideChange={() => undefined}
        onBonusDurationChange={() => undefined}
        onBonusDurationCommit={() => undefined}
        onBonusDurationStep={() => undefined}
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

  test('changes a Side availability through an accessible select', async () => {
    const user = userEvent.setup();
    const onSideChange =
      vi.fn<(key: string, patch: Partial<RewardSideDraft>) => void>();
    render(
      <RewardDiceEditor
        assets={[]}
        draft={{
          enabled: true,
          scheduleMode: 'frequency',
          triggerPhaseType: 'focus',
          frequency: '1',
          customPhaseKeys: [],
          rerolls: '0',
          sides: [
            {
              key: 'tea',
              icon: '☕',
              title: 'Tea',
              description: '',
              weight: '',
              availability: 'any',
            },
            {
              key: 'walk',
              icon: '🚶',
              title: 'Walk',
              description: '',
              weight: '',
              availability: 'late',
            },
          ],
        }}
        errors={{}}
        onEnabledChange={() => undefined}
        onScheduleModeChange={() => undefined}
        onTriggerPhaseTypeChange={() => undefined}
        onFrequencyChange={() => undefined}
        onRerollsChange={() => undefined}
        onSideChange={onSideChange}
        onBonusDurationChange={() => undefined}
        onBonusDurationCommit={() => undefined}
        onBonusDurationStep={() => undefined}
        onAddSide={() => undefined}
        onRemoveSide={() => undefined}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText('Reward side 1 availability'),
      'early',
    );

    expect(onSideChange).toHaveBeenCalledWith('tea', {
      availability: 'early',
    });
  });

  test('selects the phase type used for Reward Dice cadence', async () => {
    const user = userEvent.setup();
    const onTriggerPhaseTypeChange = vi.fn();
    render(
      <RewardDiceEditor
        assets={[]}
        draft={{
          enabled: true,
          scheduleMode: 'frequency',
          triggerPhaseType: 'focus',
          frequency: '1',
          customPhaseKeys: [],
          rerolls: '0',
          sides: [],
        }}
        errors={{}}
        onEnabledChange={() => undefined}
        onScheduleModeChange={() => undefined}
        onTriggerPhaseTypeChange={onTriggerPhaseTypeChange}
        onFrequencyChange={() => undefined}
        onRerollsChange={() => undefined}
        onSideChange={() => undefined}
        onBonusDurationChange={() => undefined}
        onBonusDurationCommit={() => undefined}
        onBonusDurationStep={() => undefined}
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
        assets={[]}
        draft={{
          enabled: true,
          scheduleMode: 'frequency',
          triggerPhaseType: 'focus',
          frequency: '1',
          customPhaseKeys: [],
          rerolls: '0',
          sides: [],
        }}
        errors={{ 'reward:rerolls': 'Choose between 0 and 3 rerolls.' }}
        onEnabledChange={() => undefined}
        onScheduleModeChange={() => undefined}
        onTriggerPhaseTypeChange={() => undefined}
        onFrequencyChange={() => undefined}
        onRerollsChange={onRerollsChange}
        onSideChange={() => undefined}
        onBonusDurationChange={() => undefined}
        onBonusDurationCommit={() => undefined}
        onBonusDurationStep={() => undefined}
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

  test('reveals accessible Side Bonus Phase environment controls when enabled', async () => {
    const user = userEvent.setup();
    const onSideChange =
      vi.fn<(key: string, patch: Partial<RewardSideDraft>) => void>();
    render(
      <RewardDiceEditor
        assets={[]}
        draft={{
          enabled: true,
          scheduleMode: 'frequency',
          triggerPhaseType: 'focus',
          frequency: '1',
          customPhaseKeys: [],
          rerolls: '0',
          sides: [
            {
              key: 'tea',
              icon: '☕',
              title: 'Tea',
              description: '',
              weight: '',
              availability: 'any',
              bonusPhase: {
                enabled: true,
                name: '',
                durationMinutes: '5',
                backgroundAsset: undefined,
                audioAsset: undefined,
                backgroundColor: '',
              },
            },
            {
              key: 'walk',
              icon: '🚶',
              title: 'Walk',
              description: '',
              weight: '',
              availability: 'any',
              bonusPhase: {
                enabled: false,
                name: '',
                durationMinutes: '5',
                backgroundAsset: undefined,
                audioAsset: undefined,
                backgroundColor: '',
              },
            },
          ],
        }}
        errors={{}}
        onEnabledChange={() => undefined}
        onScheduleModeChange={() => undefined}
        onTriggerPhaseTypeChange={() => undefined}
        onFrequencyChange={() => undefined}
        onRerollsChange={() => undefined}
        onSideChange={onSideChange}
        onBonusDurationChange={() => undefined}
        onBonusDurationCommit={() => undefined}
        onBonusDurationStep={() => undefined}
        onAddSide={() => undefined}
        onRemoveSide={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Side 1 Bonus Phase name')).toBeVisible();
    expect(
      screen.getByLabelText('Side 1 Bonus Phase background image'),
    ).toBeVisible();
    expect(
      screen.getByLabelText('Side 1 Bonus Phase ambient audio'),
    ).toBeVisible();
    await user.click(screen.getByLabelText('Enable Bonus Phase for side 1'));
    expect(onSideChange).toHaveBeenCalledOnce();
    expect(onSideChange.mock.calls[0]?.[0]).toBe('tea');
    expect(onSideChange.mock.calls[0]?.[1].bonusPhase?.enabled).toBe(false);
  });
});
