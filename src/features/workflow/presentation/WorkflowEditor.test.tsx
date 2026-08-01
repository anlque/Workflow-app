import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset } from '@/features/assets';

import type { CreateWorkflowInput } from '../domain/Workflow';
import { useWorkflowEditor } from './useWorkflowEditor';
import { WorkflowEditor } from './WorkflowEditor';

const image = createAsset({
  id: 'image-1',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 10,
  createdAt: 1_000,
});

describe('WorkflowEditor', () => {
  test('retains invalid duration input and blocks saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        assets={[image]}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    const duration = screen.getByLabelText('Phase 1 duration in minutes');
    await user.clear(duration);
    await user.type(duration, '0.25');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(duration).toHaveValue(0.25);
    expect(
      screen.getByText(
        'Duration must be at least 0.5 minutes in 0.5-minute increments.',
      ),
    ).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('shows minutes and saves them as whole seconds', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor workflowId="workflow-1" assets={[]} onSave={onSave} />,
    );

    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    const duration = screen.getByLabelText('Phase 1 duration in minutes');
    expect(duration).toHaveValue(25);
    await user.clear(duration);
    await user.type(duration, '0.5');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        phases: [expect.objectContaining({ durationSeconds: 30 })],
      }),
    );
  });

  test('keeps at least two Reward Dice sides in editor state', () => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    const side = result.current.draft.rewardDice.sides[0];
    expect(side).toBeDefined();

    act(() => {
      result.current.removeRewardSide(side?.key ?? 'missing');
    });

    expect(result.current.draft.rewardDice.sides).toHaveLength(2);
  });

  test('adds, reorders and saves ordered Phases with Asset references', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        assets={[image]}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    await user.selectOptions(
      screen.getByLabelText('Background image'),
      image.id,
    );
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    await user.selectOptions(screen.getByLabelText('Phase 2 type'), 'break');
    await user.click(screen.getByRole('button', { name: 'Move Phase 2 up' }));
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    const saved = onSave.mock.calls[0]?.[0];
    expect(saved?.id).toBe('workflow-1');
    expect(saved?.name).toBe('Deep work');
    expect(saved?.phases[0]?.type).toBe('break');
    expect(saved?.phases[1]?.type).toBe('focus');
    expect(saved?.phases[1]?.environment.backgroundAssetId).toBe(image.id);
  });

  test('validates enabled Reward Dice frequency', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor workflowId="workflow-1" assets={[]} onSave={onSave} />,
    );

    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    await user.click(screen.getByLabelText('Enable Reward Dice'));
    await user.clear(screen.getByLabelText('Reward frequency'));
    await user.type(screen.getByLabelText('Reward frequency'), '0');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(
      screen.getByText('Frequency must be a positive whole number.'),
    ).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });
});
