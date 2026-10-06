import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createAsset, createAssetRole } from '@/features/assets';

import type { CreateWorkflowInput } from '../domain/Workflow';
import { createWorkflow } from '../domain/createWorkflow';
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

const roleAudio = createAsset({
  id: 'audio-1',
  name: 'Rain',
  kind: 'audio',
  mimeType: 'audio/mpeg',
  byteSize: 10,
  createdAt: 1_000,
  role: 'Ambient',
});

function workflowWithBonus() {
  return createWorkflow({
    id: 'workflow-1',
    name: 'Bonus rewards',
    phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    rewardDice: {
      frequency: 1,
      sides: [
        {
          icon: 'tea',
          title: 'Tea',
          bonusPhase: {
            name: 'Tea break',
            durationSeconds: 300,
            environment: {},
          },
        },
        { icon: 'walk', title: 'Walk' },
      ],
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('WorkflowEditor', () => {
  test('hydrates, edits and saves an optional Phase name', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor
        workflow={createWorkflow({
          id: 'workflow-1',
          name: 'Named phases',
          phases: [
            {
              name: 'Writing',
              type: 'focus',
              durationSeconds: 1_500,
              environment: {},
            },
          ],
        })}
        workflowId="workflow-1"
        assets={[]}
        onSave={onSave}
      />,
    );

    const name = screen.getByLabelText('Phase 1 name');
    expect(name).toHaveValue('Writing');
    await user.clear(name);
    await user.type(name, '  Drafting  ');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        phases: [expect.objectContaining({ name: 'Drafting' })],
      }),
    );
  });

  test('distinguishes disclosure names after duplicating a named Phase', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowEditor
        workflow={createWorkflow({
          id: 'workflow-1',
          name: 'Named phases',
          phases: [
            {
              name: 'Writing',
              type: 'focus',
              durationSeconds: 1_500,
              environment: {},
            },
          ],
        })}
        workflowId="workflow-1"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Duplicate Phase 1' }));

    expect(
      screen.getByRole('button', { name: 'Collapse Phase 1: Writing' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Collapse Phase 2: Writing' }),
    ).toBeVisible();
  });

  test('collapses a Phase locally and reopens it when validation fails', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    const duration = screen.getByLabelText('Phase 1 duration in minutes');
    await user.clear(duration);
    await user.type(duration, '1.2');

    const disclosure = screen.getByRole('button', {
      name: 'Collapse Phase 1',
    });
    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    const contentId = disclosure.getAttribute('aria-controls');
    expect(contentId).not.toBeNull();
    const content = document.getElementById(contentId ?? 'missing');
    expect(content).toBeInTheDocument();
    expect(content).toHaveAttribute('hidden');
    expect(
      screen.getByLabelText('Phase 1 duration in minutes'),
    ).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(content).not.toHaveAttribute('hidden');
    expect(screen.getByLabelText('Phase 1 duration in minutes')).toBeVisible();
    expect(
      screen.getByText(
        'Duration must be at least 0.5 minutes in 0.5-minute increments.',
      ),
    ).toBeVisible();
  });

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

  test('normalizes a valid duration only when the field blurs', async () => {
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
    await user.type(duration, '1.0');
    expect(duration).toHaveValue('1.0');

    await user.tab();
    expect(duration).toHaveValue('1');
    expect(
      screen.queryByText(
        'Duration must be at least 0.5 minutes in 0.5-minute increments.',
      ),
    ).not.toBeInTheDocument();
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

  test('does not step below the half-minute minimum with ArrowDown', async () => {
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
    await user.type(duration, '0.5');
    await user.keyboard('{ArrowDown}');

    expect(duration).toHaveValue('0.5');
    expect(
      screen.queryByText(
        'Duration must be at least 0.5 minutes in 0.5-minute increments.',
      ),
    ).not.toBeInTheDocument();
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

  test('loads and saves Side availability in the editor draft', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Timed rewards',
      phases: [
        { type: 'focus', durationSeconds: 60, environment: {} },
        { type: 'focus', durationSeconds: 60, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'e', title: 'Early', availability: 'early' },
          { icon: 'l', title: 'Late', availability: 'late' },
        ],
      },
    });
    const { result } = renderHook(() =>
      useWorkflowEditor('workflow-1', workflow),
    );

    expect(
      result.current.draft.rewardDice.sides.map(
        ({ availability }) => availability,
      ),
    ).toEqual(['early', 'late']);
    const validation = validateWorkflowDraft(result.current.draft);
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      expect(
        validation.input.rewardDice?.sides.map(
          ({ availability }) => availability,
        ),
      ).toEqual(['early', 'late']);
    }
  });

  test('hydrates, edits and saves a Side Bonus Phase in minutes', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Bonus rewards',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'tea',
            title: 'Tea',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 300,
              environment: {
                backgroundAsset: { type: 'direct', assetId: 'image-1' },
                backgroundColor: '#123456',
              },
            },
          },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const { result } = renderHook(() =>
      useWorkflowEditor('workflow-1', workflow),
    );
    const firstSide = result.current.draft.rewardDice.sides[0];
    if (firstSide === undefined) throw new Error('Expected first Dice Side.');

    expect(firstSide.bonusPhase).toMatchObject({
      enabled: true,
      name: 'Tea break',
      durationMinutes: '5',
      backgroundAsset: { type: 'direct', assetId: 'image-1' },
      backgroundColor: '#123456',
    });
    const validation = validateWorkflowDraft(result.current.draft);
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      expect(validation.input.rewardDice?.sides[0]?.bonusPhase).toMatchObject({
        name: 'Tea break',
        durationSeconds: 300,
      });
    }
  });

  test('keeps an invalid Bonus draft out of save and reports Side-scoped errors', () => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    const side = result.current.draft.rewardDice.sides[0];
    if (side === undefined) throw new Error('Expected first Dice Side.');
    const bonusPhase = side.bonusPhase;
    if (bonusPhase === undefined) throw new Error('Expected Bonus draft.');
    const second = result.current.draft.rewardDice.sides[1];
    if (second === undefined) throw new Error('Expected second Dice Side.');
    act(() => {
      result.current.setName('Workflow');
      result.current.setRewardEnabled(true);
      result.current.updateRewardSide(side.key, {
        icon: 'tea',
        title: 'Tea',
        bonusPhase: {
          ...bonusPhase,
          enabled: true,
          name: ' ',
          durationMinutes: '1.2',
        },
      });
      result.current.updateRewardSide(second.key, {
        icon: 'walk',
        title: 'Walk',
      });
    });

    const validation = validateWorkflowDraft(result.current.draft);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.errors[`reward:${side.key}:bonus:name`]).toBe(
        'Bonus Phase name is required.',
      );
      expect(validation.errors[`reward:${side.key}:bonus:duration`]).toBe(
        'Duration must be at least 0.5 minutes in 0.5-minute increments.',
      );
    }
  });

  test('preserves the Bonus draft across toggle off/on and omits it while disabled', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        workflow={workflowWithBonus()}
        assets={[]}
        onSave={onSave}
      />,
    );
    const toggle = screen.getByLabelText('Enable Bonus Phase for side 1');
    const name = screen.getByLabelText('Side 1 Bonus Phase name');
    await user.clear(name);
    await user.type(name, 'Long tea break');

    await user.click(toggle);
    expect(screen.queryByLabelText('Side 1 Bonus Phase name')).toBeNull();
    await user.click(toggle);
    expect(screen.getByLabelText('Side 1 Bonus Phase name')).toHaveValue(
      'Long tea break',
    );

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0].rewardDice?.sides[0]).not.toHaveProperty(
      'bonusPhase',
    );
  });

  test('saves direct and Role references selected for a Bonus Environment', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        workflow={workflowWithBonus()}
        assets={[image, roleAudio]}
        onSave={onSave}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText('Side 1 Bonus Phase background image'),
      'direct:image-1',
    );
    await user.selectOptions(
      screen.getByLabelText('Side 1 Bonus Phase ambient audio'),
      'role:ambient',
    );
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(
      onSave.mock.calls[0]?.[0].rewardDice?.sides[0]?.bonusPhase?.environment,
    ).toEqual({
      backgroundAsset: { type: 'direct', assetId: image.id },
      audioAsset: { type: 'role', role: 'Ambient' },
    });
  });

  test('commits and steps Bonus duration like ordinary Phase duration', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        workflow={workflowWithBonus()}
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    const duration = screen.getByLabelText(
      'Side 1 Bonus Phase duration in minutes',
    );

    await user.clear(duration);
    await user.type(duration, '1.0');
    await user.tab();
    expect(duration).toHaveValue('1');

    await user.clear(duration);
    await user.type(duration, '0.5');
    await user.keyboard('{ArrowDown}');
    expect(duration).toHaveValue('0.5');
    await user.keyboard('{ArrowUp}');
    expect(duration).toHaveValue('1');

    await user.clear(duration);
    await user.type(duration, '1.2');
    await user.tab();
    expect(duration).toHaveValue('1.2');
    expect(
      screen.getByText(
        'Duration must be at least 0.5 minutes in 0.5-minute increments.',
      ),
    ).toBeVisible();
  });

  test('identifies the first Reward opportunity without an available Side', () => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    act(() => {
      result.current.addPhase();
      result.current.setRewardEnabled(true);
      for (const side of result.current.draft.rewardDice.sides) {
        result.current.updateRewardSide(side.key, { availability: 'late' });
      }
    });

    const validation = validateWorkflowDraft(result.current.draft);

    expect(validation.valid).toBe(false);
    if (validation.valid) throw new Error('Expected invalid draft.');
    expect(validation.errors['reward:sides']).toBe(
      'Reward opportunity 1 needs at least one available Side.',
    );
  });

  test('keeps the minimum Side error ahead of availability coverage', () => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    const validation = validateWorkflowDraft({
      ...result.current.draft,
      rewardDice: {
        ...result.current.draft.rewardDice,
        enabled: true,
        sides: [],
      },
    });

    expect(validation.valid).toBe(false);
    if (validation.valid) throw new Error('Expected invalid draft.');
    expect(validation.errors['reward:sides']).toBe(
      'Reward Dice needs at least two sides.',
    );
  });

  test('shows frequency markers and converts a manual toggle to custom', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowEditor
        workflowId="workflow-1"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );

    await user.click(screen.getByLabelText('Enable Reward Dice'));
    const marker = screen.getByLabelText('Reward after Phase 1');
    expect(marker).toBeChecked();

    await user.click(marker);

    expect(marker).not.toBeChecked();
    expect(screen.getByLabelText('Reward schedule')).toHaveValue('custom');
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
      `direct:${image.id}`,
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
    expect(saved?.phases[1]?.environment.backgroundAsset).toEqual({
      type: 'direct',
      assetId: image.id,
    });
  });

  test('announces button reordering, preserves focus and collapse by Phase key', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowEditor
        workflowId="workflow-order"
        workflow={createWorkflow({
          id: 'workflow-order',
          name: 'Ordered',
          phases: [
            {
              name: 'Writing',
              type: 'focus',
              durationSeconds: 60,
              environment: {},
            },
            {
              name: 'Review',
              type: 'break',
              durationSeconds: 60,
              environment: {},
            },
          ],
        })}
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Collapse Phase 1: Writing' }),
    );
    const move = screen.getByRole('button', { name: 'Move Phase 1 down' });
    move.focus();
    await user.click(move);
    expect(
      screen.getByText('Moved Writing to position 2 of 2.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Move Phase 2 up' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('button', { name: 'Expand Phase 2: Writing' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Move Phase 1 up' }),
    ).toBeDisabled();
  });

  test('previews and commits pointer reorder once from the dedicated handle', () => {
    render(
      <WorkflowEditor
        workflowId="workflow-drag"
        workflow={createWorkflow({
          id: 'workflow-drag',
          name: 'Dragged',
          phases: [
            {
              name: 'One',
              type: 'focus',
              durationSeconds: 60,
              environment: {},
            },
            {
              name: 'Two',
              type: 'break',
              durationSeconds: 60,
              environment: {},
            },
            {
              name: 'Three',
              type: 'focus',
              durationSeconds: 60,
              environment: {},
            },
          ],
        })}
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    const items = screen.getAllByRole('listitem');
    items.forEach((item, index) => {
      vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
        top: index * 100,
        bottom: index * 100 + 80,
        height: 80,
      } as DOMRect);
    });
    const handle = screen.getByLabelText('Drag Phase 1: One');
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    fireEvent.pointerDown(handle, {
      pointerId: 7,
      button: 0,
      isPrimary: true,
      clientY: 20,
    });
    fireEvent.pointerMove(handle, { pointerId: 7, clientY: 260 });
    expect(screen.getByTestId('phase-drop-indicator')).toBeVisible();
    fireEvent.pointerUp(handle, { pointerId: 7, clientY: 260 });
    expect(
      screen
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(['Two', 'Three', 'One']);
    expect(
      screen.getByText('Moved One to position 3 of 3.'),
    ).toBeInTheDocument();
  });

  test('announces pointer cancellation and unnamed button movement', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowEditor
        workflowId="workflow-cancel"
        workflow={createWorkflow({
          id: 'workflow-cancel',
          name: 'Cancel',
          phases: [
            { type: 'focus', durationSeconds: 60, environment: {} },
            { type: 'break', durationSeconds: 60, environment: {} },
          ],
        })}
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    const items = screen.getAllByRole('listitem');
    items.forEach((item, index) => {
      vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
        top: index * 100,
        bottom: index * 100 + 80,
        height: 80,
      } as DOMRect);
    });
    const handle = screen.getByLabelText('Drag Phase 1');
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    fireEvent.pointerDown(handle, {
      pointerId: 11,
      button: 0,
      isPrimary: true,
      clientY: 20,
    });
    fireEvent.pointerMove(handle, { pointerId: 11, clientY: 160 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('Phase move cancelled.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move Phase 1 down' }));
    expect(
      screen.getByText('Moved Phase 1 to position 2 of 2.'),
    ).toBeInTheDocument();
  });

  test('replaces the live-region node for repeated identical announcements', () => {
    render(
      <WorkflowEditor
        workflowId="workflow-repeat-announcement"
        workflow={createWorkflow({
          id: 'workflow-repeat-announcement',
          name: 'Repeat announcement',
          phases: [
            { type: 'focus', durationSeconds: 60, environment: {} },
            { type: 'break', durationSeconds: 60, environment: {} },
          ],
        })}
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    const items = screen.getAllByRole('listitem');
    items.forEach((item, index) => {
      vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
        top: index * 100,
        bottom: index * 100 + 80,
        height: 80,
      } as DOMRect);
    });
    const handle = screen.getByLabelText('Drag Phase 1');
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    const cancelDrag = (pointerId: number) => {
      fireEvent.pointerDown(handle, {
        pointerId,
        button: 0,
        isPrimary: true,
        clientY: 20,
      });
      fireEvent.pointerMove(handle, { pointerId, clientY: 80 });
      fireEvent.pointerCancel(handle, { pointerId });
    };

    cancelDrag(31);
    const firstAnnouncement = screen.getByText('Phase move cancelled.');
    cancelDrag(32);
    const secondAnnouncement = screen.getByText('Phase move cancelled.');

    expect(secondAnnouncement).not.toBe(firstAnnouncement);
  });

  test('preserves a Role reference through unrelated edits and save', async () => {
    const user = userEvent.setup();
    const roleImage = createAsset({
      ...image,
      id: 'role-image',
      role: 'Hero scene',
    });
    const workflow = createWorkflow({
      id: 'workflow-role',
      name: 'Original',
      phases: [
        {
          type: 'focus',
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'role', role: 'Hero scene' },
          },
        },
      ],
    });
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const view = render(
      <WorkflowEditor
        workflowId={workflow.id}
        workflow={workflow}
        assets={[roleImage]}
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText('Background color'));
    await user.type(screen.getByLabelText('Background color'), '#112233');
    view.rerender(
      <WorkflowEditor
        workflowId={workflow.id}
        workflow={workflow}
        assets={[{ ...roleImage }]}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    expect(
      onSave.mock.calls[0]?.[0].phases[0]?.environment.backgroundAsset,
    ).toEqual({ type: 'role', role: 'Hero scene' });
  });

  test('preserves a Role reference when its Phase is reordered', async () => {
    const user = userEvent.setup();
    const roleImage = createAsset({
      ...image,
      id: 'role-image',
      role: 'Hero scene',
    });
    const workflow = createWorkflow({
      id: 'workflow-role-order',
      name: 'Ordered',
      phases: [
        {
          type: 'focus',
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'role', role: 'Hero scene' },
          },
        },
        { type: 'break', durationSeconds: 30, environment: {} },
      ],
    });
    const onSave = vi.fn<(input: CreateWorkflowInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    render(
      <WorkflowEditor
        workflowId={workflow.id}
        workflow={workflow}
        assets={[roleImage]}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Move Phase 2 up' }));
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(
      onSave.mock.calls[0]?.[0].phases[1]?.environment.backgroundAsset,
    ).toEqual({ type: 'role', role: 'Hero scene' });
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

    expect(onSave.mock.calls[0]?.[0].rewardDice?.schedule).toEqual({
      type: 'frequency',
      triggerPhaseType: 'break',
      frequency: 1,
    });
  });

  test('serializes six-Phase custom markers from stable draft keys', () => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    act(() => {
      for (let index = 0; index < 5; index += 1) result.current.addPhase();
    });
    const phaseKeys = result.current.draft.phases.map(({ key }) => key);
    act(() => {
      result.current.toggleRewardAfterPhase(phaseKeys[0] ?? 'missing');
      result.current.toggleRewardAfterPhase(phaseKeys[4] ?? 'missing');
    });

    const validation = validateWorkflowDraft({
      ...result.current.draft,
      name: 'Custom',
      rewardDice: {
        ...result.current.draft.rewardDice,
        enabled: true,
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
      },
    });

    expect(validation.valid && validation.input.rewardDice?.schedule).toEqual({
      type: 'custom',
      phaseIndexes: [1, 2, 3, 5],
    });
  });

  test.each([
    ['missing', ['missing-key']],
    ['duplicate', ['phase-key', 'phase-key']],
  ])('rejects %s custom marker keys', (_case, customPhaseKeys) => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    const phaseKey = result.current.draft.phases[0]?.key ?? 'missing';
    const validation = validateWorkflowDraft({
      ...result.current.draft,
      name: 'Custom',
      rewardDice: {
        ...result.current.draft.rewardDice,
        enabled: true,
        scheduleMode: 'custom',
        customPhaseKeys: customPhaseKeys.map((key) =>
          key === 'phase-key' ? phaseKey : key,
        ),
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
      },
    });

    expect(validation.valid).toBe(false);
    if (validation.valid) throw new Error('Expected invalid draft.');
    expect(validation.errors['reward:schedule']).toBe(
      'Choose valid Reward markers for this Workflow.',
    );
  });

  test('moves, deletes and duplicates custom markers with stable Phase keys', () => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    act(() => {
      result.current.addPhase();
      result.current.addPhase();
    });
    const firstKey = result.current.draft.phases[0]?.key ?? 'missing-first';
    const sourceKey = result.current.draft.phases[1]?.key ?? 'missing-source';
    act(() => {
      result.current.updatePhase(sourceKey, {
        name: 'Writing',
        backgroundColor: '#123456',
      });
      result.current.toggleRewardAfterPhase(firstKey);
      result.current.movePhaseTo(sourceKey, 2);
      result.current.duplicatePhase(2);
    });
    expect(result.current.draft.rewardDice.customPhaseKeys).toHaveLength(3);
    const duplicateKey =
      result.current.draft.phases[3]?.key ?? 'missing-duplicate';
    expect(result.current.draft.rewardDice.customPhaseKeys).toContain(
      sourceKey,
    );
    expect(result.current.draft.rewardDice.customPhaseKeys).toContain(
      duplicateKey,
    );
    expect(result.current.draft.phases[3]).toMatchObject({
      name: 'Writing',
      backgroundColor: '#123456',
    });
    act(() => {
      result.current.updatePhase(duplicateKey, { name: 'Review' });
    });
    expect(
      result.current.draft.phases.find(({ key }) => key === sourceKey)?.name,
    ).toBe('Writing');
    expect(result.current.draft.phases[3]?.name).toBe('Review');
    act(() => {
      result.current.removePhase(sourceKey);
    });
    expect(result.current.draft.rewardDice.customPhaseKeys).not.toContain(
      sourceKey,
    );
    expect(result.current.draft.rewardDice.customPhaseKeys).toContain(
      duplicateKey,
    );
  });

  test('moves complete Phase drafts to deterministic final indexes', () => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    act(() => {
      result.current.addPhase();
      result.current.addPhase();
    });
    const [first, second, third] = result.current.draft.phases;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Expected three Phase drafts.');
    }
    act(() => {
      result.current.updatePhase(second.key, {
        name: 'Portable',
        backgroundAsset: { type: 'direct', assetId: image.id },
        audioAsset: { type: 'role', role: createAssetRole('Ambient') },
        backgroundColor: '#123456',
      });
      result.current.toggleRewardAfterPhase(first.key);
      result.current.toggleRewardAfterPhase(third.key);
      result.current.movePhaseTo(second.key, 2);
    });
    expect(result.current.draft.phases.map(({ key }) => key)).toEqual([
      first.key,
      third.key,
      second.key,
    ]);
    expect(result.current.draft.phases[2]).toMatchObject({
      key: second.key,
      name: 'Portable',
      backgroundAsset: { type: 'direct', assetId: image.id },
      audioAsset: { type: 'role', role: roleAudio.role },
      backgroundColor: '#123456',
    });
    const validation = validateWorkflowDraft({
      ...result.current.draft,
      name: 'Reordered',
      rewardDice: {
        ...result.current.draft.rewardDice,
        enabled: true,
        scheduleMode: 'custom',
        sides: [
          {
            key: 'a',
            icon: 'A',
            title: 'A',
            description: '',
            weight: '',
            availability: 'any',
          },
          {
            key: 'b',
            icon: 'B',
            title: 'B',
            description: '',
            weight: '',
            availability: 'any',
          },
        ],
      },
    });
    expect(validation.valid && validation.input.rewardDice?.schedule).toEqual({
      type: 'custom',
      phaseIndexes: [2],
    });

    act(() => {
      result.current.movePhaseTo(second.key, 0);
    });
    expect(result.current.draft.phases.map(({ key }) => key)).toEqual([
      second.key,
      first.key,
      third.key,
    ]);
  });

  test.each([
    ['unknown key', 'missing', 0],
    ['negative index', 'existing', -1],
    ['fractional index', 'existing', 0.5],
    ['past-end index', 'existing', 1],
    ['same position', 'existing', 0],
  ] as const)('keeps the draft reference for %s', (_case, key, targetIndex) => {
    const { result } = renderHook(() => useWorkflowEditor('workflow-1'));
    const before = result.current.draft;
    const phaseKey =
      key === 'existing' ? (before.phases[0]?.key ?? 'missing') : key;
    act(() => {
      result.current.movePhaseTo(phaseKey, targetIndex);
    });
    expect(result.current.draft).toBe(before);
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
