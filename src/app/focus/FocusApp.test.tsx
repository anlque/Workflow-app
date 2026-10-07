import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { StrictMode } from 'react';

import {
  createSession,
  continueRewardSession,
  deriveSessionState,
  rollSessionReward,
  type Session,
  type SessionProjectionClient,
} from '@/features/session';
import { createWorkflow } from '@/features/workflow';
import { defaultSettings } from '@/features/settings';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';
import { createAsset, createAssetId } from '@/features/assets';
import type { WorkflowStudioDependencies } from '../workflow-studio/WorkflowStudio';

import { FocusApp, type FocusDependencies } from './FocusApp';

function studioDependencies(
  workflows: Awaited<
    ReturnType<WorkflowStudioDependencies['load']>
  >['workflows'] = [],
): WorkflowStudioDependencies {
  return {
    preferences: createTestDocumentPreferences(),
    openSidePanel: vi.fn(() => Promise.resolve()),
    closeSidePanel: vi.fn(() => Promise.resolve()),
    subscribeSidePanelState: vi.fn(() => vi.fn()),
    load: vi.fn(() =>
      Promise.resolve({ workflows, assets: [], settings: defaultSettings }),
    ),
    saveWorkflow: vi.fn(() => Promise.resolve()),
    duplicateWorkflow: vi.fn(() => Promise.resolve()),
    deleteWorkflow: vi.fn(() => Promise.resolve()),
    reorderWorkflows: vi.fn(() => Promise.resolve()),
    importAsset: vi.fn(() =>
      Promise.resolve(
        createAsset({
          id: 'focus-image',
          name: 'image',
          kind: 'image',
          mimeType: 'image/png',
          byteSize: 1,
          createdAt: 1,
        }),
      ),
    ),
    synchronizeAssetImport: vi.fn(() => Promise.resolve()),
    inspectAssetRetirement: vi.fn(),
    retireAsset: vi.fn(() => Promise.resolve()),
    synchronizeAssetRetirement: vi.fn(() => Promise.resolve()),
    createAssetRetirementUploadInput: vi.fn(),
    inspectAssetRoleChange: vi.fn(),
    applyAssetRoleChange: vi.fn(() => Promise.resolve()),
    synchronizeAssetRoleChange: vi.fn(() => Promise.resolve()),
    loadAssetBlob: vi.fn(() => Promise.resolve(null)),
    createObjectUrl: vi.fn(() => 'blob:test'),
    revokeObjectUrl: vi.fn(),
    updateSettings: vi.fn(() => Promise.resolve()),
    exportSettings: vi.fn(() => Promise.resolve()),
    importSettings: vi.fn(() => Promise.resolve()),
    exportWorkflow: vi.fn(() => Promise.resolve()),
    importWorkflow: vi.fn(() => Promise.resolve()),
    createId: vi.fn(() => 'new-workflow'),
  };
}

function dependencies(
  session: Session | null,
  studio: WorkflowStudioDependencies = studioDependencies(),
  preferences = createTestDocumentPreferences(),
): FocusDependencies {
  return {
    preferences,
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
    restartPhase: vi.fn(() => Promise.resolve()),
    continueReward: vi.fn(() => Promise.resolve()),
    rollReward: vi.fn(() => Promise.resolve()),
    rerollReward: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    updateAudioSettings: vi.fn(() => Promise.resolve()),
    loadAssetUrl: vi.fn(() => Promise.resolve(null)),
    releaseAssetUrl: vi.fn(),
    closeSidePanel: vi.fn(() => Promise.resolve()),
    openSidePanel: vi.fn(() => Promise.resolve()),
    subscribeSidePanelState: vi.fn(() => vi.fn()),
    subscribeWorkflowChanges: vi.fn(() => vi.fn()),
    listWorkflows: vi.fn(() => Promise.resolve([])),
    start: vi.fn(() => Promise.resolve()),
    loadStudio: vi.fn(() => Promise.resolve(studio)),
  } satisfies FocusDependencies & { sessions: SessionProjectionClient };
}

describe('FocusApp', () => {
  test('opens Studio from idle Focus, inerts Focus and restores the trigger', async () => {
    const user = userEvent.setup();
    const deps = dependencies(null);
    const { container } = render(<FocusApp dependencies={deps} />);
    const trigger = await screen.findByRole('button', {
      name: 'Open Workflow Studio',
    });
    expect(deps.loadStudio).not.toHaveBeenCalled();

    await user.click(trigger);

    expect(
      await screen.findByRole('button', { name: 'Close Workflow Studio' }),
    ).toHaveFocus();
    await waitFor(() => {
      expect(deps.loadStudio).toHaveBeenCalledOnce();
    });
    expect(container.querySelector('.focus-app-surface')).toHaveAttribute(
      'inert',
    );

    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(container.querySelector('.focus-app-surface')).not.toHaveAttribute(
      'inert',
    );
  });

  test('toggles the Side Panel inside Studio without closing the overlay', async () => {
    const user = userEvent.setup();
    const studio = studioDependencies();
    const openSidePanel = vi.fn(() => Promise.resolve());
    Object.assign(studio, {
      openSidePanel,
      closeSidePanel: vi.fn(() => Promise.resolve()),
      subscribeSidePanelState: vi.fn(() => vi.fn()),
    });
    const deps = dependencies(null, studio);
    render(<FocusApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Open Workflow Studio' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Open side panel' }),
    );

    expect(openSidePanel).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Close Workflow Studio' }),
    ).toBeVisible();
  });

  test('keeps the Session subscription and ambient player mounted across Studio toggles', async () => {
    const user = userEvent.setup();
    const disconnect = vi.fn();
    const session = createSession(
      'overlay-audio-session',
      createWorkflow({
        id: 'overlay-audio-workflow',
        name: 'Ambient focus',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: {
              audioAsset: {
                type: 'direct',
                assetId: createAssetId('ambient-overlay'),
              },
            },
          },
        ],
      }),
      Date.now(),
    );
    const deps = dependencies(session);
    vi.mocked(deps.sessions.subscribe).mockReturnValue(disconnect);
    vi.mocked(deps.loadAssetUrl).mockResolvedValue('blob:ambient-overlay');
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Ambient focus' });
    await act(async () => Promise.resolve());
    const audio = document.querySelector('audio');
    expect(audio).toBeInstanceOf(HTMLAudioElement);

    await user.click(
      screen.getByRole('button', { name: 'Open Workflow Studio' }),
    );
    await screen.findByRole('button', { name: 'Close Workflow Studio' });
    await user.click(
      screen.getByRole('button', { name: 'Close Workflow Studio' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Open Workflow Studio' }),
    );

    expect(document.querySelector('audio')).toBe(audio);
    expect(deps.sessions.subscribe).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
  });

  test('preserves an unsaved Studio draft after close and reopen', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'draft-workflow',
      name: 'Original name',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    const deps = dependencies(null, studioDependencies([workflow]));
    vi.mocked(deps.listWorkflows).mockResolvedValue([workflow]);
    render(<FocusApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Open Workflow Studio' }),
    );
    const name = await screen.findByLabelText('Workflow name');
    await user.clear(name);
    await user.type(name, 'Unsaved name');
    await user.click(
      screen.getByRole('button', { name: 'Close Workflow Studio' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Open Workflow Studio' }),
    );

    expect(await screen.findByLabelText('Workflow name')).toHaveValue(
      'Unsaved name',
    );
  });

  test('restores focus to the stable Studio trigger when the opening trigger is removed', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'first-workflow',
      name: 'First workflow',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    let workflows: readonly (typeof workflow)[] = [];
    let invalidate: (() => void) | undefined;
    const studio = studioDependencies();
    vi.mocked(studio.load).mockImplementation(() =>
      Promise.resolve({
        workflows,
        assets: [],
        settings: defaultSettings,
      }),
    );
    vi.mocked(studio.saveWorkflow).mockImplementation(() => {
      workflows = [workflow];
      invalidate?.();
      return Promise.resolve();
    });
    const deps = dependencies(null, studio);
    vi.mocked(deps.listWorkflows).mockImplementation(() =>
      Promise.resolve(workflows),
    );
    vi.mocked(deps.subscribeWorkflowChanges).mockImplementation((listener) => {
      invalidate = listener;
      return vi.fn();
    });
    const { container } = render(<FocusApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Create a Workflow' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Create workflow' }),
    );
    await user.type(screen.getByLabelText('Workflow name'), 'First workflow');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    await waitFor(() => {
      expect(container.querySelector('.focus-launcher')).toHaveTextContent(
        'First workflow',
      );
    });
    await user.click(
      screen.getByRole('button', { name: 'Close Workflow Studio' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Start First workflow' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Open Workflow Studio' }),
    ).toHaveFocus();
  });

  test('suppresses a newly active Reward dialog until Studio closes', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'overlay-reward-workflow',
      name: 'Reward focus',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const running = createSession('overlay-reward-session', workflow, 1_000);
    const rewardPaused = deriveSessionState(running, 3_000);
    const deps = dependencies(running);
    let publish: ((session: Session | null) => void) | undefined;
    vi.mocked(deps.sessions.subscribe).mockImplementation((listener) => {
      publish = listener;
      return vi.fn();
    });
    render(<FocusApp dependencies={deps} />);
    await screen.findByRole('heading', { name: 'Reward focus' });

    await user.click(
      screen.getByRole('button', { name: 'Open Workflow Studio' }),
    );
    act(() => {
      publish?.(rewardPaused);
    });

    expect(document.querySelector('dialog.dialog--reward')).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Close Workflow Studio' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Reward unlocked' }),
    ).toBeVisible();
  });

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
        ...preferences.getSnapshot(),
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

  test('controls independently persisted music and cue channels', async () => {
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
    const preferences = createTestDocumentPreferences({
      theme: 'system',
      reducedMotion: 'system',
      effectiveReducedMotion: false,
      ambientVolumePercent: 80,
      ambientMuted: false,
      cueVolumePercent: 60,
      cuesMuted: false,
      muteCuesWithMusic: false,
    });
    const deps = dependencies(session, studioDependencies(), preferences);
    render(<FocusApp dependencies={deps} />);

    const musicVolume = await screen.findByRole('slider', {
      name: 'Music volume',
    });
    const cueVolume = screen.getByRole('slider', { name: 'Cue volume' });
    expect(musicVolume).toHaveValue('80');
    expect(cueVolume).toHaveValue('60');
    expect(deps.sounds.setVolume).toHaveBeenLastCalledWith(0.6);

    fireEvent.change(musicVolume, { target: { value: '35' } });
    expect(deps.updateAudioSettings).toHaveBeenLastCalledWith({
      ambientVolumePercent: 35,
    });

    await user.click(screen.getByRole('button', { name: 'Mute music' }));
    expect(deps.updateAudioSettings).toHaveBeenLastCalledWith({
      ambientMuted: true,
    });

    await user.click(screen.getByRole('button', { name: 'Mute cues' }));
    expect(deps.updateAudioSettings).toHaveBeenLastCalledWith({
      cuesMuted: true,
    });

    act(() => {
      preferences.setSnapshot({
        ...preferences.getSnapshot(),
        ambientMuted: true,
        muteCuesWithMusic: true,
      });
    });
    expect(deps.sounds.setVolume).toHaveBeenLastCalledWith(0);
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
            environment: {
              audioAsset: {
                type: 'direct',
                assetId: createAssetId('ambient-1'),
              },
            },
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
    const rolled = rollSessionReward(completed, () => 0);
    vi.mocked(deps.rollReward).mockImplementation(() => {
      publish?.(rolled);
      return Promise.resolve();
    });
    vi.mocked(deps.continueReward).mockImplementation(() => {
      publish?.(continueRewardSession(rolled, 4_000, 'continue-1'));
      return Promise.resolve();
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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
      await Promise.resolve();
    });
    act(() => {
      fireEvent.ended(screen.getByTestId('reward-dice-video'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await Promise.resolve();
    });
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
