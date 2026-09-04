import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createAsset } from '@/features/assets';

import type { CreateWorkflowInput } from '../domain/Workflow';
import { useWorkflowEditor, validateWorkflowDraft } from './useWorkflowEditor';
import { WorkflowEditor } from './WorkflowEditor';

const image = createAsset({
  id: 'image-1',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 10,
  createdAt: 1_000,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WorkflowEditor', () => {
  test('preserves a partial decimal while typing and across a rerender', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const view = render(
      <WorkflowEditor workflowId="workflow-1" assets={[]} onSave={onSave} />,
    );
    const duration = screen.getByLabelText('Phase 1 duration in minutes');

    await user.clear(duration);
    await user.type(duration, '1.');
    expect(duration).toHaveValue('1.');

    view.rerender(
      <WorkflowEditor workflowId="workflow-1" assets={[]} onSave={onSave} />,
    );
    expect(duration).toHaveValue('1.');
  });

  test('preserves invalid input and shows its field error only after blur', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    const duration = screen.getByLabelText('Phase 1 duration in minutes');

    await user.clear(duration);
    await user.type(duration, '.');
    expect(duration).toHaveValue('.');
    expect(
      screen.queryByText(
        'Duration must be at least 0.5 minutes in 0.5-minute increments.',
      ),
    ).not.toBeInTheDocument();

    await user.tab();
    expect(duration).toHaveValue('.');
    expect(
      screen.getByText(
        'Duration must be at least 0.5 minutes in 0.5-minute increments.',
      ),
    ).toBeVisible();
  });

  test('steps by half a minute with arrow keys and saves integer seconds', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor workflowId="workflow-1" assets={[]} onSave={onSave} />,
    );
    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    const duration = screen.getByLabelText('Phase 1 duration in minutes');

    await user.clear(duration);
    await user.type(duration, '1');
    await user.keyboard('{ArrowUp}');
    expect(duration).toHaveValue('1.5');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        phases: [expect.objectContaining({ durationSeconds: 90 })],
      }),
    );
  });

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

    expect(duration).toHaveValue('0.25');
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
    expect(duration).toHaveValue('25');
    await user.clear(duration);
    await user.type(duration, '0.5');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        phases: [expect.objectContaining({ durationSeconds: 30 })],
      }),
    );
  });

  test('confirms a successful save and clears stale success after editing', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor workflowId="workflow-1" assets={[]} onSave={onSave} />,
    );

    const name = screen.getByLabelText('Workflow name');
    await user.type(name, 'Deep work');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Workflow saved',
    );

    await user.type(name, ' updated');
    expect(screen.queryByText('Workflow saved')).not.toBeInTheDocument();
  });

  test('removes successful save feedback after three seconds', async () => {
    vi.useFakeTimers();
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Workflow name'), {
      target: { value: 'Deep work' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save workflow' }));
    await act(() => Promise.resolve());
    expect(screen.getByRole('status')).toHaveTextContent('Workflow saved');

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.queryByText('Workflow saved')).not.toBeInTheDocument();
  });

  test('does not show success feedback when saving fails', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        assets={[]}
        onSave={() => Promise.reject(new Error('Storage unavailable.'))}
      />,
    );

    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage unavailable.',
    );
    expect(screen.queryByText('Workflow saved')).not.toBeInTheDocument();
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

  test('defaults rerolls to zero and rejects drafts outside the allowed range', () => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));

    expect(result.current.draft.rewardDice.rerolls).toBe('0');
    act(() => {
      result.current.setRewardEnabled(true);
      result.current.setRewardRerolls('4');
    });

    const validation = validateWorkflowDraft(result.current.draft);
    expect(validation.valid).toBe(false);
    if (validation.valid) throw new Error('Expected invalid rerolls.');
    expect(validation.errors['reward:rerolls']).toBe(
      'Choose between 0 and 3 rerolls.',
    );
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

  test('saves break phases as the Reward Dice cadence trigger', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor workflowId="workflow-1" assets={[]} onSave={onSave} />,
    );

    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    await user.click(screen.getByLabelText('Enable Reward Dice'));
    await user.selectOptions(screen.getByLabelText('Reward after'), 'break');
    await user.type(screen.getByLabelText('Reward side 1 icon'), '☕');
    await user.type(screen.getByLabelText('Reward side 1 title'), 'Tea');
    await user.type(screen.getByLabelText('Reward side 2 icon'), '🚶');
    await user.type(screen.getByLabelText('Reward side 2 title'), 'Walk');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(onSave.mock.calls[0]?.[0].rewardDice?.triggerPhaseType).toBe(
      'break',
    );
  });

  test('saves the configured Reward Dice rerolls', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor workflowId="workflow-1" assets={[]} onSave={onSave} />,
    );

    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    await user.click(screen.getByLabelText('Enable Reward Dice'));
    await user.selectOptions(screen.getByLabelText('Available rerolls'), '3');
    await user.type(screen.getByLabelText('Reward side 1 icon'), '☕');
    await user.type(screen.getByLabelText('Reward side 1 title'), 'Tea');
    await user.type(screen.getByLabelText('Reward side 2 icon'), '🚶');
    await user.type(screen.getByLabelText('Reward side 2 title'), 'Walk');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(onSave.mock.calls[0]?.[0].rewardDice?.rerolls).toBe(3);
  });
});
