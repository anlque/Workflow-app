import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { StrictMode } from 'react';

import {
  createSession,
  deriveSessionState,
  type Session,
  type SessionProjectionClient,
} from '@/features/session';
import { createWorkflow } from '@/features/workflow';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';
import { createAssetId } from '@/features/assets';

import { FocusApp, type FocusDependencies } from './FocusApp';

function dependencies(session: Session | null): FocusDependencies {
  return {
    preferences: createTestDocumentPreferences(),
    sounds: {
      unlock: vi.fn(() => Promise.resolve(true)),
      getState: vi.fn(() => 'ready' as const),
      setVolume: vi.fn(),
      playBell: vi.fn(),
      playDiceRoll: vi.fn(),
      playSessionComplete: vi.fn(),
      playRewardUnlocked: vi.fn(),
      dispose: vi.fn(),
    },
    sessions: {
      getActive: () => Promise.resolve(session),
      subscribe: vi.fn(() => vi.fn()),
    },
    pause: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
    continueReward: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    loadAssetUrl: vi.fn(() => Promise.resolve(null)),
    releaseAssetUrl: vi.fn(),
    closeSidePanel: vi.fn(() => Promise.resolve()),
    openSidePanel: vi.fn(() => Promise.resolve()),
    subscribeSidePanelState: vi.fn(() => vi.fn()),
    subscribeWorkflowChanges: vi.fn(() => vi.fn()),
    listWorkflows: vi.fn(() => Promise.resolve([])),
    start: vi.fn(() => Promise.resolve()),
    openOptions: vi.fn(() => Promise.resolve()),
  } satisfies FocusDependencies & { sessions: SessionProjectionClient };
}

describe('FocusApp', () => {
  test('updates active presentation when effective reduced motion changes', async () => {
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
    const preferences = deps.preferences as ReturnType<
      typeof createTestDocumentPreferences
    >;
    const { container } = render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Deep work' });
    expect(container.querySelector('.focus-environment')).toHaveAttribute(
      'data-reduced-motion',
      'false',
    );
    act(() => {
      preferences.setSnapshot({
        theme: 'system',
        reducedMotion: 'reduce',
        effectiveReducedMotion: true,
      });
    });
    expect(container.querySelector('.focus-environment')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
  });

  test('does not dispose document-scoped sounds during StrictMode effect checks', async () => {
    const deps = dependencies(null);

    render(
      <StrictMode>
        <FocusApp dependencies={deps} />
      </StrictMode>,
    );
    await screen.findByRole('heading', { name: 'Choose a Workflow' });

    expect(deps.sounds.dispose).not.toHaveBeenCalled();
  });

  test('shows the Workflow launcher without an active Session', async () => {
    const deps = dependencies(null);
    const { container } = render(<FocusApp dependencies={deps} />);
    expect(
      await screen.findByRole('heading', { name: 'Choose a Workflow' }),
    ).toBeVisible();
    expect(deps.listWorkflows).toHaveBeenCalledOnce();
    expect(deps.closeSidePanel).not.toHaveBeenCalled();
    expect(container.querySelector('.brand-logo')).toHaveAttribute(
      'src',
      '/brand/locusora-mark.svg',
    );
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
    const deps = dependencies(session);
    let invalidate: (() => void) | undefined;
    vi.mocked(deps.subscribeWorkflowChanges).mockImplementation((listener) => {
      invalidate = listener;
      return vi.fn();
    });
    render(<FocusApp dependencies={deps} />);

    expect(
      await screen.findByRole('heading', { name: 'Deep work' }),
    ).toBeVisible();
    expect(screen.getByTestId('focus-environment')).toHaveStyle({
      backgroundColor: '#123456',
    });
    invalidate?.();
    expect(deps.listWorkflows).not.toHaveBeenCalled();
  });

  test('controls master sound volume during an active Session', async () => {
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
    render(<FocusApp dependencies={deps} />);

    const volume = await screen.findByRole('slider', { name: 'Volume' });
    expect(volume).toHaveValue('100');

    fireEvent.change(volume, { target: { value: '35' } });
    expect(deps.sounds.setVolume).toHaveBeenLastCalledWith(0.35);

    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(deps.sounds.setVolume).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Unmute sound' }));
    expect(deps.sounds.setVolume).toHaveBeenLastCalledWith(0.35);
    expect(volume).toHaveValue('35');
  });

  test('keeps the Session countdown running when ambient audio pauses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(10_000);
    const session = createSession(
      'session-1',
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: { audioAssetId: createAssetId('ambient-1') },
          },
        ],
      }),
      Date.now(),
    );
    const deps = dependencies(session);
    vi.mocked(deps.loadAssetUrl).mockResolvedValue('blob:ambient');
    render(<FocusApp dependencies={deps} />);
    const countdown = await screen.findByLabelText('Time remaining');
    const audio = document.querySelector('audio');
    if (!(audio instanceof HTMLAudioElement)) {
      throw new Error('Ambient audio element was not rendered.');
    }
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      audio.dispatchEvent(new Event('pause'));
    });
    expect(
      await screen.findByRole('button', { name: 'Resume audio' }),
    ).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(countdown).toHaveTextContent('00:59');
    expect(deps.pause).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('refreshes the idle launcher after catalog invalidation', async () => {
    const initial = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    const renamed = createWorkflow({
      id: 'workflow-1',
      name: 'Renamed work',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    const deps = dependencies(null);
    let invalidate: (() => void) | undefined;
    vi.mocked(deps.subscribeWorkflowChanges).mockImplementation((listener) => {
      invalidate = listener;
      return vi.fn();
    });
    vi.mocked(deps.listWorkflows)
      .mockResolvedValueOnce([initial])
      .mockResolvedValueOnce([renamed]);
    render(<FocusApp dependencies={deps} />);
    expect(
      await screen.findByRole('button', { name: 'Start Deep work' }),
    ).toBeVisible();

    invalidate?.();

    expect(
      await screen.findByRole('button', { name: 'Start Renamed work' }),
    ).toBeVisible();
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

  test('plays final completion only after Reward continuation', async () => {
    vi.useFakeTimers();
    const workflow = createWorkflow({
      id: 'rewarded-workflow',
      name: 'Rewarded work',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const initial = createSession('session-rewarded', workflow, 1_000);
    const completed = deriveSessionState(initial, 3_000);
    const deps = dependencies(initial);
    let publish: ((session: Session | null) => void) | undefined;
    vi.mocked(deps.sessions.subscribe).mockImplementation((listener) => {
      publish = listener;
      return vi.fn();
    });
    render(<FocusApp dependencies={deps} />);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      publish?.(completed);
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(deps.sounds.playRewardUnlocked).toHaveBeenCalledOnce();
    expect(deps.sounds.playSessionComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Session complete')).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(deps.sounds.playSessionComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(deps.sounds.playSessionComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
