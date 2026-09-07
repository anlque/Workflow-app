import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createSession, deriveSessionState } from '@/features/session';
import { createWorkflow } from '@/features/workflow';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';

import { SidePanelApp, type SidePanelDependencies } from './SidePanelApp';

function dependencies(
  workflows: Awaited<ReturnType<SidePanelDependencies['listWorkflows']>> = [],
  activeSession: Awaited<
    ReturnType<SidePanelDependencies['sessions']['getActive']>
  > = null,
): SidePanelDependencies {
  return {
    preferences: createTestDocumentPreferences(),
    listWorkflows: () => Promise.resolve(workflows),
    subscribeWorkflowChanges: vi.fn(() => vi.fn()),
    createWorkflow: () => Promise.resolve(),
    duplicateWorkflow: () => Promise.resolve(),
    deleteWorkflow: () => Promise.resolve(),
    reorderWorkflows: () => Promise.resolve(),
    openWorkflow: vi.fn(() => Promise.resolve()),
    sessions: {
      getActive: () => Promise.resolve(activeSession),
      subscribe: () => vi.fn(),
    },
    startSession: vi.fn(() => Promise.resolve()),
    pauseSession: vi.fn(() => Promise.resolve()),
    resumeSession: vi.fn(() => Promise.resolve()),
    stopSession: vi.fn(() => Promise.resolve()),
    openFocusView: vi.fn(() => Promise.resolve()),
    closeSidePanel: vi.fn(() => Promise.resolve()),
  };
}

describe('SidePanelApp', () => {
  test('shows the compact Workflow empty state', async () => {
    const { container } = render(
      <SidePanelApp dependencies={dependencies()} />,
    );
    expect(
      await screen.findByText('Build your first focus rhythm.'),
    ).toBeVisible();
    expect(container.querySelector('.brand-logo')).toHaveAttribute(
      'src',
      '/brand/locusora-mark.svg',
    );
  });

  test('opens a Workflow in the options editor', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([workflow]);
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Open Deep work' }),
    );
    expect(deps.openWorkflow).toHaveBeenCalledWith(workflow.id);
  });

  test('closes the Side Panel through the injected dependency', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Close side panel' }),
    );

    expect(deps.closeSidePanel).toHaveBeenCalledOnce();
  });

  test('disables the close control and coalesces rapid clicks while pending', async () => {
    let finishClose: (() => void) | undefined;
    const deps = dependencies();
    Object.assign(deps, {
      closeSidePanel: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishClose = resolve;
          }),
      ),
    });
    render(<SidePanelApp dependencies={deps} />);
    const close = await screen.findByRole('button', {
      name: 'Close side panel',
    });

    fireEvent.click(close);
    fireEvent.click(close);
    fireEvent.click(close);

    expect(close).toBeDisabled();
    expect(close).toHaveAttribute('aria-busy', 'true');
    expect(close).toHaveTextContent('Closing…');
    expect(deps.closeSidePanel).toHaveBeenCalledOnce();

    await act(async () => {
      finishClose?.();
      await Promise.resolve();
    });
  });

  test('shows a recoverable close error without hiding Side Panel content', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    Object.assign(deps, {
      closeSidePanel: vi.fn(() =>
        Promise.reject(new Error('Unable to close the Side Panel. Try again.')),
      ),
    });
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Close side panel' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to close the Side Panel. Try again.',
    );
    expect(screen.getByText('Build your first focus rhythm.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Close side panel' }),
    ).toBeEnabled();
  });

  test('allows retrying Side Panel close after a failure', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    Object.assign(deps, {
      closeSidePanel: vi
        .fn()
        .mockRejectedValueOnce(new Error('Close failed.'))
        .mockResolvedValueOnce(undefined),
    });
    render(<SidePanelApp dependencies={deps} />);
    const close = await screen.findByRole('button', {
      name: 'Close side panel',
    });

    await user.click(close);
    expect(await screen.findByRole('alert')).toHaveTextContent('Close failed.');
    await user.click(close);

    expect(deps.closeSidePanel).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('starts a Workflow and opens the focus view in a new tab', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([workflow]);
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Start Deep work' }),
    );
    expect(deps.startSession).toHaveBeenCalledWith(workflow.id);
    expect(deps.openFocusView).toHaveBeenCalledOnce();
  });

  test('shows mirrored controls for an active Session', async () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies(
      [workflow],
      createSession('session-1', workflow, Date.now()),
    );
    render(<SidePanelApp dependencies={deps} />);

    expect(
      await screen.findByRole('heading', { name: 'Deep work' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Open focus view' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  test('browses Workflows and returns without changing the active Session', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies(
      [workflow],
      createSession('session-1', workflow, Date.now()),
    );
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Back to workflows' }),
    );

    expect(
      screen.getByRole('button', { name: 'Open Deep work' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Active session summary' }),
    ).toBeVisible();
    expect(deps.pauseSession).not.toHaveBeenCalled();
    expect(deps.stopSession).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Return to session' }));

    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  test('does not show the compact bar for a terminal Session', async () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
    });
    const completed = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );
    render(<SidePanelApp dependencies={dependencies([workflow], completed)} />);

    expect(
      await screen.findByRole('button', { name: 'Open Deep work' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Active session summary' }),
    ).not.toBeInTheDocument();
  });

  test('refreshes the visible Workflow list after catalog invalidation', async () => {
    const initial = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const renamed = createWorkflow({
      id: 'workflow-1',
      name: 'Renamed work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([initial]);
    let invalidate: (() => void) | undefined;
    vi.mocked(deps.subscribeWorkflowChanges).mockImplementation((listener) => {
      invalidate = listener;
      return vi.fn();
    });
    vi.spyOn(deps, 'listWorkflows')
      .mockResolvedValueOnce([initial])
      .mockResolvedValueOnce([renamed]);
    render(<SidePanelApp dependencies={deps} />);
    expect(
      await screen.findByRole('button', { name: 'Open Deep work' }),
    ).toBeVisible();

    invalidate?.();

    expect(
      await screen.findByRole('button', { name: 'Open Renamed work' }),
    ).toBeVisible();
  });
});
