import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow, type Workflow } from '@/features/workflow';

import { WorkflowLibrary } from './WorkflowLibrary';

function workflow(id: string, name: string, durationSeconds = 1_500): Workflow {
  return createWorkflow({
    id,
    name,
    phases: [{ type: 'focus', durationSeconds, environment: {} }],
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

function rewardWorkflow(id: string, name: string): Workflow {
  return createWorkflow({
    id,
    name,
    phases: [
      { type: 'focus', durationSeconds: 1_500, environment: {} },
      { type: 'break', durationSeconds: 300, environment: {} },
    ],
    rewardDice: {
      frequency: 1,
      sides: [
        { icon: 'tea', title: 'Tea' },
        { icon: 'walk', title: 'Walk' },
      ],
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
    onExport: vi.fn(() => Promise.resolve()),
    onImport: vi.fn(() => Promise.resolve()),
  };
  render(<WorkflowLibrary workflows={workflows} {...callbacks} />);
  return callbacks;
}

async function openActions(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    screen.getByRole('button', { name: `More actions for ${name}` }),
  );
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
    await openActions(user, 'Deep work');
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

  test('shows reliable duration, phase, and Reward summaries without speculative controls', () => {
    setup([
      workflow('plain', 'Plain focus'),
      rewardWorkflow('reward', 'Reward focus'),
    ]);

    const plain = screen.getByRole('listitem', { name: 'Plain focus' });
    expect(plain).toHaveTextContent('25 min');
    expect(plain).toHaveTextContent('1 phase');
    expect(plain).toHaveTextContent('Reward off');

    const reward = screen.getByRole('listitem', { name: 'Reward focus' });
    expect(reward).toHaveTextContent('30 min');
    expect(reward).toHaveTextContent('2 phases');
    expect(reward).toHaveTextContent('Reward on');

    expect(
      screen.getByRole('searchbox', { name: 'Search workflows' }),
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Sort workflows' }),
    ).toHaveValue('manual');
  });

  test('filters both groups case-insensitively and sorts only the rendered projection', async () => {
    const user = userEvent.setup();
    const source = [
      workflow('detailed-z', 'Zulu Detailed'),
      quickWorkflow('quick-a', 'Alpha Quick'),
      workflow('detailed-a', 'Alpha Detailed'),
      quickWorkflow('quick-z', 'Zulu Quick'),
    ];
    setup(source);

    await user.type(
      screen.getByRole('searchbox', { name: 'Search workflows' }),
      'ALPHA',
    );
    expect(
      screen
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['Alpha Quick', 'Alpha Detailed']);

    await user.clear(
      screen.getByRole('searchbox', { name: 'Search workflows' }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort workflows' }),
      'name-asc',
    );
    expect(
      screen
        .getAllByRole('button', { name: /^Open /u })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Open Alpha Quick',
      'Open Zulu Quick',
      'Open Alpha Detailed',
      'Open Zulu Detailed',
    ]);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort workflows' }),
      'name-desc',
    );
    expect(
      screen
        .getAllByRole('button', { name: /^Open /u })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Open Zulu Quick',
      'Open Alpha Quick',
      'Open Zulu Detailed',
      'Open Alpha Detailed',
    ]);
    expect(source.map(({ id }) => id)).toEqual([
      'detailed-z',
      'quick-a',
      'detailed-a',
      'quick-z',
    ]);
    expect(
      screen.queryByRole('button', { name: /Move .* (up|down)/u }),
    ).toBeNull();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort workflows' }),
      'manual',
    );
    await openActions(user, 'Alpha Quick');
    expect(
      screen.getByRole('button', { name: 'Move Alpha Quick down' }),
    ).toBeEnabled();
  });

  test.each(['Move Middle up', 'Move Middle down', 'Duplicate Middle'])(
    'closes overflow and restores its trigger focus after %s succeeds',
    async (actionName) => {
      const user = userEvent.setup();
      setup([
        workflow('first', 'First'),
        workflow('middle', 'Middle'),
        workflow('last', 'Last'),
      ]);
      const trigger = screen.getByRole('button', {
        name: 'More actions for Middle',
      });

      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByRole('button', { name: actionName }));

      expect(
        screen.queryByRole('button', { name: actionName }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveFocus();
    },
  );

  test('supports page import, row export and overflow management actions', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const callbacks = setup([deepWork]);

    await user.click(screen.getByRole('button', { name: 'Import workflow' }));
    const input = screen.getByLabelText('Import workflow file');
    await user.upload(
      input,
      new File(['{}'], 'workflow.json', { type: 'application/json' }),
    );
    expect(callbacks.onImport).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Export Deep work' }));
    expect(callbacks.onExport).toHaveBeenCalledWith(deepWork.id);

    await user.click(
      screen.getByRole('button', { name: 'More actions for Deep work' }),
    );
    expect(
      screen.getByRole('button', { name: 'Duplicate Deep work' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Delete Deep work' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Move Deep work up' }),
    ).toBeVisible();
  });

  test('announces successful import and export while allowing the same file again', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const callbacks = setup([deepWork]);
    const file = new File(['{}'], 'workflow.json', {
      type: 'application/json',
    });
    const input = screen.getByLabelText('Import workflow file');

    await user.upload(input, file);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Workflow imported.',
    );
    await user.upload(input, file);
    expect(callbacks.onImport).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Export Deep work' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Workflow exported.',
    );
    expect(callbacks.onExport).toHaveBeenCalledWith(deepWork.id);
  });

  test('renders injected thumbnails with a neutral fallback', () => {
    const first = workflow('first', 'First');
    const second = workflow('second', 'Second');
    const renderThumbnail = vi.fn((value: Workflow) =>
      value.id === first.id ? (
        <img
          src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
          alt="First preview"
        />
      ) : undefined,
    );
    render(
      <WorkflowLibrary
        workflows={[first, second]}
        onCreate={() => Promise.resolve()}
        onOpen={() => undefined}
        onDuplicate={() => Promise.resolve()}
        onDelete={() => Promise.resolve()}
        onReorder={() => Promise.resolve()}
        onExport={() => Promise.resolve()}
        onImport={() => Promise.resolve()}
        renderThumbnail={renderThumbnail}
      />,
    );

    expect(screen.getByAltText('First preview')).toBeVisible();
    expect(screen.getByTestId('workflow-thumbnail-second')).toHaveClass(
      'workflow-list__thumbnail--fallback',
    );
    expect(renderThumbnail).toHaveBeenCalledTimes(2);
  });

  test.each([
    [1, '1 sec'],
    [90, '1 min 30 sec'],
    [3_600, '1 hr'],
  ])(
    'preserves significant seconds when formatting a %i-second Workflow',
    (durationSeconds, expectedDuration) => {
      setup([workflow('duration', 'Duration example', durationSeconds)]);

      expect(
        screen.getByRole('listitem', { name: 'Duration example' }),
      ).toHaveTextContent(expectedDuration);
    },
  );

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
    await openActions(user, 'Quick one');
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

  test('returns focus to the closed overflow trigger after cancelling deletion', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const { onDelete } = setup([deepWork]);
    const trigger = screen.getByRole('button', {
      name: 'More actions for Deep work',
    });

    await openActions(user, 'Deep work');
    await user.click(screen.getByRole('button', { name: 'Delete Deep work' }));
    expect(
      screen.getByRole('dialog', { name: 'Delete Deep work?' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(onDelete).not.toHaveBeenCalled();
  });

  test('returns focus to the closed overflow trigger after Escape', async () => {
    const user = userEvent.setup();
    setup([workflow('workflow-1', 'Deep work')]);
    const trigger = screen.getByRole('button', {
      name: 'More actions for Deep work',
    });

    await openActions(user, 'Deep work');
    await user.click(screen.getByRole('button', { name: 'Delete Deep work' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Deep work?' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  test('moves focus to the stable create control after successful deletion', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const onDelete = vi.fn<(id: Workflow['id']) => Promise<void>>(() =>
      Promise.resolve(),
    );
    function DeletionHarness() {
      const [workflows, setWorkflows] = useState<readonly Workflow[]>([
        deepWork,
      ]);
      return (
        <WorkflowLibrary
          workflows={workflows}
          onCreate={() => Promise.resolve()}
          onOpen={() => undefined}
          onDuplicate={() => Promise.resolve()}
          onDelete={async (id) => {
            await onDelete(id);
            setWorkflows([]);
          }}
          onReorder={() => Promise.resolve()}
        />
      );
    }
    render(<DeletionHarness />);

    await openActions(user, 'Deep work');
    await user.click(screen.getByRole('button', { name: 'Delete Deep work' }));
    await user.click(screen.getByRole('button', { name: 'Delete workflow' }));

    expect(onDelete).toHaveBeenCalledWith(deepWork.id);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Create workflow' }),
      ).toHaveFocus();
    });
  });

  test('keeps a failed deletion open with focus inside the dialog', async () => {
    const user = userEvent.setup();
    const deepWork = workflow('workflow-1', 'Deep work');
    const onDelete = vi.fn(() => Promise.reject(new Error('Delete failed.')));
    render(
      <WorkflowLibrary
        workflows={[deepWork]}
        onCreate={() => Promise.resolve()}
        onOpen={() => undefined}
        onDuplicate={() => Promise.resolve()}
        onDelete={onDelete}
        onReorder={() => Promise.resolve()}
      />,
    );

    await openActions(user, 'Deep work');
    await user.click(screen.getByRole('button', { name: 'Delete Deep work' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Deep work?' });
    await user.click(screen.getByRole('button', { name: 'Delete workflow' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Delete failed.',
    );
    expect(dialog).toBeVisible();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  test('moves Workflows with complete ordered identifiers', async () => {
    const user = userEvent.setup();
    const first = workflow('workflow-1', 'Deep work');
    const second = workflow('workflow-2', 'Reading');
    const { onReorder } = setup([first, second]);

    await openActions(user, 'Deep work');
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

    await openActions(user, 'Deep work');

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
