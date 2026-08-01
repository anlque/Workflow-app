import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import {
  createSession,
  type SessionProjectionClient,
} from '@/features/session';
import { createWorkflow } from '@/features/workflow';

import { FocusApp, type FocusDependencies } from './FocusApp';

function dependencies(
  session: ReturnType<typeof createSession> | null,
): FocusDependencies {
  return {
    sessions: {
      getActive: () => Promise.resolve(session),
      subscribe: () => vi.fn(),
    },
    pause: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    loadAssetUrl: vi.fn(() => Promise.resolve(null)),
    releaseAssetUrl: vi.fn(),
    loadReducedMotion: vi.fn(() => Promise.resolve(false)),
    closeSidePanel: vi.fn(() => Promise.resolve()),
    openSidePanel: vi.fn(() => Promise.resolve()),
    subscribeSidePanelState: vi.fn(() => vi.fn()),
    listWorkflows: vi.fn(() => Promise.resolve([])),
    start: vi.fn(() => Promise.resolve()),
    openOptions: vi.fn(() => Promise.resolve()),
  } satisfies FocusDependencies & { sessions: SessionProjectionClient };
}

describe('FocusApp', () => {
  test('shows the Workflow launcher without an active Session', async () => {
    const deps = dependencies(null);
    render(<FocusApp dependencies={deps} />);
    expect(
      await screen.findByRole('heading', { name: 'Choose a Workflow' }),
    ).toBeVisible();
    expect(deps.listWorkflows).toHaveBeenCalledOnce();
    expect(deps.closeSidePanel).not.toHaveBeenCalled();
  });

  test('renders the current Session and Phase environment', async () => {
    const session = createSession(
      'session-1',
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: { backgroundColor: '#123456' },
          },
        ],
      }),
      Date.now(),
    );
    render(<FocusApp dependencies={dependencies(session)} />);

    expect(
      await screen.findByRole('heading', { name: 'Deep work' }),
    ).toBeVisible();
    expect(screen.getByTestId('focus-environment')).toHaveStyle({
      backgroundColor: '#123456',
    });
  });

  test('changes the side-panel action after closing and can reopen it', async () => {
    const user = userEvent.setup();
    const deps = dependencies(null);
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Choose a Workflow' });

    await user.click(screen.getByRole('button', { name: 'Close side panel' }));
    expect(deps.closeSidePanel).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('button', { name: 'Open side panel' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open side panel' }));
    expect(deps.openSidePanel).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('button', { name: 'Close side panel' }),
    ).toBeVisible();
  });

  test('updates the action immediately while Chrome is still closing the panel', async () => {
    const user = userEvent.setup();
    let finishClose: (() => void) | undefined;
    const deps = dependencies(null);
    vi.mocked(deps.closeSidePanel).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Choose a Workflow' });

    await user.click(screen.getByRole('button', { name: 'Close side panel' }));

    expect(
      screen.getByRole('button', { name: 'Open side panel' }),
    ).toBeVisible();
    finishClose?.();
  });

  test('restores the label when Chrome rejects the panel operation', async () => {
    const user = userEvent.setup();
    const deps = dependencies(null);
    vi.mocked(deps.closeSidePanel).mockRejectedValueOnce(
      new Error('Panel operation failed.'),
    );
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Choose a Workflow' });

    await user.click(screen.getByRole('button', { name: 'Close side panel' }));

    expect(
      await screen.findByRole('button', { name: 'Close side panel' }),
    ).toBeVisible();
  });
});
