import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset, createAssetRole } from '@/features/assets';

import { createWorkflow } from '../domain/createWorkflow';
import type { CreateWorkflowInput } from '../domain/Workflow';
import { QuickWorkflowEditor } from './QuickWorkflowEditor';

describe('QuickWorkflowEditor', () => {
  test('uses native-validation bypass and clears duration invalid state after normalization', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <QuickWorkflowEditor
        workflowId="quick-validation"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
    const duration = screen.getByLabelText('Focus duration in minutes');
    await user.clear(duration);
    await user.type(duration, '0.2');
    fireEvent.blur(duration);
    expect(duration).toHaveAttribute('aria-invalid', 'true');
    await user.clear(duration);
    await user.type(duration, '1');
    fireEvent.blur(duration);
    expect(duration).not.toHaveAttribute('aria-invalid');
  });

  test('summarizes validation and opens the drawer at the first invalid Reward side', async () => {
    const user = userEvent.setup();
    render(
      <QuickWorkflowEditor
        workflowId="quick-reward-errors"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    await user.type(screen.getByLabelText('Workflow name'), 'Rewards');
    await user.click(screen.getByRole('checkbox', { name: 'Use Reward Dice' }));
    expect(
      screen.queryByRole('dialog', { name: 'Reward sides drawer' }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(
      screen.getByText('Review the highlighted fields before saving.'),
    ).toHaveAttribute('role', 'alert');
    expect(
      screen.getByRole('dialog', { name: 'Reward sides drawer' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByLabelText('Reward side 1 icon')).toHaveFocus();
    });
  });

  test('announces a successful save temporarily', async () => {
    const user = userEvent.setup();
    render(
      <QuickWorkflowEditor
        workflowId="quick-saved"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    await user.type(screen.getByLabelText('Workflow name'), 'Saved quick');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Workflow saved',
    );
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 3_100));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('renders approved defaults and saves Quick configuration only', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((input: CreateWorkflowInput) => {
      void input;
      return Promise.resolve();
    });
    render(
      <QuickWorkflowEditor workflowId="quick-1" assets={[]} onSave={onSave} />,
    );
    expect(screen.getByLabelText('Cycles')).toHaveValue(4);
    expect(screen.getByLabelText('Focus duration in minutes')).toHaveValue(
      '25',
    );
    expect(
      screen.getByLabelText('Short Break duration in minutes'),
    ).toHaveValue('5');
    expect(
      screen.getByRole('checkbox', { name: 'Use Long Break' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Use Reward Dice' }),
    ).not.toBeChecked();

    await user.type(screen.getByLabelText('Workflow name'), 'Quick rhythm');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce();
    });
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      mode: 'quick',
      name: 'Quick rhythm',
      configuration: { cycleCount: 4 },
    });
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('phases');
  });

  test('reuses direct and Role Asset selection in every source Environment', async () => {
    const user = userEvent.setup();
    const image = createAsset({
      id: 'image',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
      role: createAssetRole('Backdrop'),
    });
    render(
      <QuickWorkflowEditor
        workflowId="quick-1"
        assets={[image]}
        onSave={() => Promise.resolve()}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText('Focus background image'),
      'role:backdrop',
    );
    expect(screen.getByLabelText('Focus background image')).toHaveValue(
      'role:backdrop',
    );
  });

  test('opens an accessible Reward sides drawer and enforces two sides', async () => {
    const user = userEvent.setup();
    render(
      <QuickWorkflowEditor
        workflowId="quick-1"
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Use Reward Dice' }));
    await user.click(screen.getByRole('button', { name: 'Configure sides' }));
    const drawer = screen.getByRole('dialog', { name: 'Reward sides drawer' });
    expect(drawer).toHaveClass('quick-reward-drawer');
    expect(screen.getAllByLabelText(/Reward side \d icon/u)).toHaveLength(2);
    await user.click(
      screen.getByRole('button', { name: 'Remove Reward side 1' }),
    );
    expect(screen.getAllByLabelText(/Reward side \d icon/u)).toHaveLength(2);
  });

  test('keeps a recoverable draft after save failure and exposes validation errors', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.reject(new Error('Storage failed.')));
    render(
      <QuickWorkflowEditor workflowId="quick-1" assets={[]} onSave={onSave} />,
    );
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(await screen.findByText('Name is required.')).toBeVisible();
    await user.type(screen.getByLabelText('Workflow name'), 'Recoverable');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage failed.',
    );
    expect(screen.getByLabelText('Workflow name')).toHaveValue('Recoverable');
  });

  test('hydrates an existing Quick Workflow without exposing Detailed controls', () => {
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick-1',
      name: 'Existing quick',
      configuration: {
        cycleCount: 3,
        focus: { durationSeconds: 1_800, environment: {} },
        shortBreak: { durationSeconds: 300, environment: {} },
      },
    });
    if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    render(
      <QuickWorkflowEditor
        workflowId="quick-1"
        workflow={workflow}
        assets={[]}
        onSave={() => Promise.resolve()}
      />,
    );
    expect(screen.getByLabelText('Workflow name')).toHaveValue(
      'Existing quick',
    );
    expect(screen.queryByText('Add Phase')).toBeNull();
    expect(
      screen.getByText(/individual Phases and advanced Reward settings/iu),
    ).toBeVisible();
  });

  test('confirms clean conversion with an unchecked optional Quick copy', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick-1',
      name: 'Existing quick',
      configuration: {
        cycleCount: 2,
        focus: { durationSeconds: 1_500, environment: {} },
        shortBreak: { durationSeconds: 300, environment: {} },
      },
    });
    if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    const onConvert = vi.fn(
      (
        input: Extract<CreateWorkflowInput, { mode: 'quick' }>,
        keep: boolean,
      ) => {
        void input;
        void keep;
        return Promise.resolve();
      },
    );
    const onSynchronizeConversion = vi.fn(() => Promise.resolve());
    render(
      <QuickWorkflowEditor
        workflowId={workflow.id}
        workflow={workflow}
        assets={[]}
        onSave={() => Promise.resolve()}
        onConvert={onConvert}
        onSynchronizeConversion={onSynchronizeConversion}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Convert to detailed' }),
    );
    expect(
      screen.getByText(/cannot be converted back to Quick Setup/iu),
    ).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Keep a Quick copy' }),
    ).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(onConvert).toHaveBeenCalledOnce();
    });
    expect(onConvert.mock.calls[0]?.[1]).toBe(false);
    expect(onSynchronizeConversion).toHaveBeenCalledOnce();
  });

  test('uses the validated dirty draft for Save and convert', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick-1',
      name: 'Existing quick',
      configuration: {
        cycleCount: 2,
        focus: { durationSeconds: 1_500, environment: {} },
        shortBreak: { durationSeconds: 300, environment: {} },
      },
    });
    if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    const onConvert = vi.fn(
      (
        input: Extract<CreateWorkflowInput, { mode: 'quick' }>,
        keep: boolean,
      ) => {
        void input;
        void keep;
        return Promise.resolve();
      },
    );
    render(
      <QuickWorkflowEditor
        workflowId={workflow.id}
        workflow={workflow}
        assets={[]}
        onSave={() => Promise.resolve()}
        onConvert={onConvert}
        onSynchronizeConversion={() => Promise.resolve()}
      />,
    );
    await user.clear(screen.getByLabelText('Workflow name'));
    await user.type(screen.getByLabelText('Workflow name'), 'Current draft');
    await user.click(
      screen.getByRole('button', { name: 'Convert to detailed' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Keep a Quick copy' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save and convert' }));

    await waitFor(() => {
      expect(onConvert).toHaveBeenCalledOnce();
    });
    expect(onConvert.mock.calls[0]?.[0]).toMatchObject({
      name: 'Current draft',
      mode: 'quick',
    });
    expect(onConvert.mock.calls[0]?.[1]).toBe(true);
  });

  test('preserves the dialog and draft across storage and post-commit sync failures', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick-1',
      name: 'Existing quick',
      configuration: {
        cycleCount: 2,
        focus: { durationSeconds: 1_500, environment: {} },
        shortBreak: { durationSeconds: 300, environment: {} },
      },
    });
    if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    const onConvert = vi
      .fn(
        (
          input: Extract<CreateWorkflowInput, { mode: 'quick' }>,
          keep: boolean,
        ) => {
          void input;
          void keep;
          return Promise.resolve();
        },
      )
      .mockRejectedValueOnce(new Error('Storage failed.'))
      .mockResolvedValue(undefined);
    const onSynchronizeConversion = vi
      .fn()
      .mockRejectedValueOnce(new Error('Reload failed.'))
      .mockResolvedValue(undefined);
    render(
      <QuickWorkflowEditor
        workflowId={workflow.id}
        workflow={workflow}
        assets={[]}
        onSave={() => Promise.resolve()}
        onConvert={onConvert}
        onSynchronizeConversion={onSynchronizeConversion}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Convert to detailed' }),
    );
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage failed.',
    );
    expect(screen.getByRole('dialog')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Reload failed.',
    );
    expect(screen.getByRole('button', { name: 'Retry sync' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry sync' }));
    await waitFor(() => {
      expect(onSynchronizeConversion).toHaveBeenCalledTimes(2);
    });
    expect(onConvert).toHaveBeenCalledTimes(2);
  });
});
