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

function quickWorkflow(id: string, name: string): Workflow {
  return createWorkflow({
    mode: 'quick',
    id,
    name,
    configuration: {
      cycleCount: 2,
      focus: { durationSeconds: 1_500, environment: {} },
      shortBreak: { durationSeconds: 300, environment: {} },
    },
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
    await user.click(screen.getByRole('button', { name: 'Detailed setup' }));

    expect(onCreate).toHaveBeenCalledWith('detailed');
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

  test('groups Quick before Detailed while preserving repository order and badges', () => {
    const detailedOne = workflow('detailed-1', 'Detailed one');
    const quickOne = quickWorkflow('quick-1', 'Quick one');
    const detailedTwo = workflow('detailed-2', 'Detailed two');
    const quickTwo = quickWorkflow('quick-2', 'Quick two');
    setup([detailedOne, quickOne, detailedTwo, quickTwo]);

    const groups = screen.getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Quick',
      'Detailed',
    ]);
    expect(
      screen.getAllByText('Quick', { selector: '.workflow-mode-badge' }),
    ).toHaveLength(2);
    expect(
      screen.getAllByText('Detailed', { selector: '.workflow-mode-badge' }),
    ).toHaveLength(2);
    expect(
      screen
        .getAllByRole('button', { name: /^Open /u })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Open Quick one',
      'Open Quick two',
      'Open Detailed one',
      'Open Detailed two',
    ]);
  });

  test('omits empty group headings', () => {
    setup([quickWorkflow('quick-1', 'Quick one')]);
    expect(screen.getByRole('group', { name: 'Quick' })).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Detailed' })).toBeNull();
  });

  test('chooses Quick or Detailed setup explicitly', async () => {
    const user = userEvent.setup();
    const { onCreate } = setup([workflow('workflow-1', 'Existing')]);
    await user.click(screen.getByRole('button', { name: 'New workflow' }));
    expect(screen.getByRole('dialog', { name: 'New workflow' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Quick setup' }));
    expect(onCreate).toHaveBeenCalledWith('quick');
  });

  test('moves only inside a mode group while returning the complete order', async () => {
    const user = userEvent.setup();
    const detailed = workflow('detailed-1', 'Detailed');
    const quickOne = quickWorkflow('quick-1', 'Quick one');
    const quickTwo = quickWorkflow('quick-2', 'Quick two');
    const { onReorder } = setup([detailed, quickOne, quickTwo]);
    await user.click(
      screen.getByRole('button', { name: 'Move Quick one down' }),
    );
    expect(onReorder).toHaveBeenCalledWith([
      detailed.id,
      quickTwo.id,
      quickOne.id,
    ]);
  });

  test('starts a Workflow when the surface provides a Start action', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const { onStart } = setup([deepWork]);

    const start = screen.getByRole('button', {
      name: 'Start workflow: Deep work',
    });
    expect(start).toHaveTextContent(/^Start workflow$/u);
    await user.click(start);
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
