import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow, type Workflow } from '@/features/workflow';

import { WorkflowLibrary } from './WorkflowLibrary';

function workflow(id: string, name: string): Workflow {
  return createWorkflow({
    id,
    name,
    phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
  });
}

function setup(workflows: readonly Workflow[] = []) {
  const callbacks = {
    onCreate: vi.fn(() => Promise.resolve()),
    onOpen: vi.fn(),
    onDuplicate: vi.fn(() => Promise.resolve()),
    onDelete: vi.fn(() => Promise.resolve()),
    onReorder: vi.fn(() => Promise.resolve()),
    onStart: vi.fn(() => Promise.resolve()),
  };
  render(<WorkflowLibrary workflows={workflows} {...callbacks} />);
  return callbacks;
}

describe('WorkflowLibrary', () => {
  test('teaches the empty state and creates the first Workflow', async () => {
    const user = userEvent.setup();
    const { onCreate } = setup();

    expect(screen.getByText('Build your first focus rhythm.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Create workflow' }));

    expect(onCreate).toHaveBeenCalledOnce();
  });

  test('opens and duplicates a Workflow', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const { onOpen, onDuplicate } = setup([deepWork]);

    await user.click(screen.getByRole('button', { name: 'Open Deep work' }));
    await user.click(
      screen.getByRole('button', { name: 'Duplicate Deep work' }),
    );

    expect(onOpen).toHaveBeenCalledWith(deepWork.id);
    expect(onDuplicate).toHaveBeenCalledWith(deepWork.id);
  });

  test('starts a Workflow when the surface provides a Start action', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const { onStart } = setup([deepWork]);

    await user.click(screen.getByRole('button', { name: 'Start Deep work' }));
    expect(onStart).toHaveBeenCalledWith(deepWork.id);
  });

  test('confirms deletion and supports cancellation', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const { onDelete } = setup([deepWork]);

    await user.click(screen.getByRole('button', { name: 'Delete Deep work' }));
    expect(
      screen.getByRole('dialog', { name: 'Delete Deep work?' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete Deep work' }));
    await user.click(screen.getByRole('button', { name: 'Delete workflow' }));

    expect(onDelete).toHaveBeenCalledWith(deepWork.id);
  });

  test('moves Workflows with complete ordered identifiers', async () => {
    const user = userEvent.setup();
    const first = workflow('workflow-1', 'Deep work');
    const second = workflow('workflow-2', 'Reading');
    const { onReorder } = setup([first, second]);

    expect(
      screen.getByRole('button', { name: 'Move Deep work up' }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Move Deep work down' }),
    );

    expect(onReorder).toHaveBeenCalledWith([second.id, first.id]);
  });

  test('announces an asynchronous action error', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const onDuplicate = vi.fn(() =>
      Promise.reject(new Error('Storage failed.')),
    );
    setup([deepWork]);
    render(
      <WorkflowLibrary
        workflows={[deepWork]}
        onCreate={() => Promise.resolve()}
        onOpen={() => undefined}
        onDuplicate={onDuplicate}
        onDelete={() => Promise.resolve()}
        onReorder={() => Promise.resolve()}
      />,
    );

    const duplicateButtons = screen.getAllByRole('button', {
      name: 'Duplicate Deep work',
    });
    const duplicateButton = duplicateButtons.at(-1);
    expect(duplicateButton).toBeDefined();
    if (duplicateButton !== undefined) await user.click(duplicateButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage failed.',
    );
  });
});
