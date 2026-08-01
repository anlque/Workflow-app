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
    sounds: {
      unlock: vi.fn(() => Promise.resolve(true)),
      getState: vi.fn(() => 'ready' as const),
      playBell: vi.fn(),
      playDiceRoll: vi.fn(),
      dispose: vi.fn(),
    },
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

  test('starts with the side panel closed and can open it', async () => {
    const user = userEvent.setup();
    const deps = dependencies(null);
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Choose a Workflow' });

    expect(
      screen.getByRole('button', { name: 'Open side panel' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open side panel' }));
    expect(deps.sounds.unlock).toHaveBeenCalledOnce();
    expect(deps.openSidePanel).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('button', { name: 'Close side panel' }),
    ).toBeVisible();
  });

  test('unlocks sounds when starting a Workflow', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    const deps = dependencies(null);
    vi.mocked(deps.listWorkflows).mockResolvedValueOnce([workflow]);
    render(<FocusApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Start Deep work' }),
    );

    expect(deps.sounds.unlock).toHaveBeenCalledOnce();
    expect(deps.start).toHaveBeenCalledWith(workflow.id);
  });

  test('offers to enable sounds for a restored Session until activation succeeds', async () => {
    const user = userEvent.setup();
    const session = createSession(
      'session-1',
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
      }),
      Date.now(),
    );
    const deps = dependencies(session);
    let state: 'locked' | 'ready' = 'locked';
    vi.mocked(deps.sounds.getState).mockImplementation(() => state);
    vi.mocked(deps.sounds.unlock).mockImplementation(() => {
      state = 'ready';
      return Promise.resolve(true);
    });
    render(<FocusApp dependencies={deps} />);

    const enable = await screen.findByRole('button', {
      name: 'Enable sounds',
    });
    await user.click(enable);

    expect(deps.sounds.unlock).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: 'Enable sounds' }),
    ).not.toBeInTheDocument();
  });

  test('updates the action immediately while Chrome is still opening the panel', async () => {
    const user = userEvent.setup();
    let finishOpen: (() => void) | undefined;
    const deps = dependencies(null);
    vi.mocked(deps.openSidePanel).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishOpen = resolve;
        }),
    );
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Choose a Workflow' });

    await user.click(screen.getByRole('button', { name: 'Open side panel' }));

    expect(
      screen.getByRole('button', { name: 'Close side panel' }),
    ).toBeVisible();
    finishOpen?.();
  });

  test('restores the label when Chrome rejects the panel operation', async () => {
    const user = userEvent.setup();
    const deps = dependencies(null);
    vi.mocked(deps.openSidePanel).mockRejectedValueOnce(
      new Error('Panel operation failed.'),
    );
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Choose a Workflow' });

    await user.click(screen.getByRole('button', { name: 'Open side panel' }));

    expect(
      await screen.findByRole('button', { name: 'Open side panel' }),
    ).toBeVisible();
  });

  test('synchronizes the action with Chrome side-panel events', async () => {
    const deps = dependencies(null);
    let notifyPanelState: ((open: boolean) => void) | undefined;
    vi.mocked(deps.subscribeSidePanelState).mockImplementation((listener) => {
      notifyPanelState = listener;
      return vi.fn();
    });
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Choose a Workflow' });

    notifyPanelState?.(true);
    expect(
      await screen.findByRole('button', { name: 'Close side panel' }),
    ).toBeVisible();

    notifyPanelState?.(false);
    expect(
      await screen.findByRole('button', { name: 'Open side panel' }),
    ).toBeVisible();
  });
});
