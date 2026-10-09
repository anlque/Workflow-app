import {
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';

import {
  ActiveSessionView,
  connectSessionMessages,
  createActiveSessionStore,
  type SessionId,
  type SessionProjectionClient,
  getActiveSessionSegment,
} from '@/features/session';
import type { AssetId } from '@/features/assets';
import {
  effectiveAmbientVolume,
  effectiveCueVolume,
} from '@/features/settings';
import {
  useWorkflowCatalog,
  type Workflow,
  type WorkflowCatalogSource,
  type WorkflowId,
} from '@/features/workflow';
import { Button } from '@/shared';
import type { DocumentPreferences } from '@/app/document-preferences/DocumentPreferences';
import { useDocumentPreferences } from '@/app/document-preferences/useDocumentPreferences';
import { useSidePanelControl } from '@/app/useSidePanelControl';
import type { WorkflowStudioDependencies } from '../workflow-studio/WorkflowStudio';
import type { SettingsPatch } from './createSettingsUpdater';

import { FocusAppearanceControls } from './FocusAppearanceControls';
import { FocusEnvironment } from './FocusEnvironment';
import { FocusLauncher } from './FocusLauncher';
import type { UiSoundPlayer } from './createUiSoundPlayer';
import { useCompletionCue } from './useCompletionCue';
import { WorkflowStudioOverlay } from './WorkflowStudioOverlay';

const LazyWorkflowStudio = lazy(() => import('./LazyWorkflowStudio'));

export type FocusDependencies = Readonly<{
  preferences: DocumentPreferences;
  sounds: UiSoundPlayer;
  sessions: SessionProjectionClient;
  pause(id: SessionId): Promise<void>;
  resume(id: SessionId): Promise<void>;
  restartPhase(id: SessionId, rewardRitualId: string): Promise<void>;
  continueReward(id: SessionId, rewardRitualId: string): Promise<void>;
  rollReward(id: SessionId, rewardRitualId: string): Promise<void>;
  rerollReward(id: SessionId, rewardRitualId: string): Promise<void>;
  stop(id: SessionId): Promise<void>;
  loadAssetUrl(id: AssetId): Promise<string | null>;
  releaseAssetUrl(url: string): void;
  closeSidePanel(): Promise<void>;
  openSidePanel(): Promise<void>;
  subscribeSidePanelState(listener: (open: boolean) => void): () => void;
  listWorkflows(): Promise<readonly Workflow[]>;
  subscribeWorkflowChanges(listener: () => void): () => void;
  start(id: WorkflowId): Promise<void>;
  loadStudio(): Promise<WorkflowStudioDependencies>;
  updateSettings(patch: SettingsPatch): Promise<void>;
}>;

function IdleFocusLauncher({
  dependencies,
  activateSounds,
  openStudio,
}: Readonly<{
  dependencies: FocusDependencies;
  activateSounds(): Promise<void>;
  openStudio(trigger: HTMLButtonElement): void;
}>) {
  const [launcherError, setLauncherError] = useState<string | null>(null);
  const [pendingWorkflowId, setPendingWorkflowId] = useState<WorkflowId>();
  const source = useMemo<WorkflowCatalogSource>(
    () => ({
      list: dependencies.listWorkflows,
      subscribeInvalidation: dependencies.subscribeWorkflowChanges,
    }),
    [dependencies],
  );
  const { workflows, refreshError } = useWorkflowCatalog(source);

  return (
    <FocusLauncher
      workflows={workflows}
      error={launcherError ?? refreshError}
      pendingWorkflowId={pendingWorkflowId}
      onOpenStudio={openStudio}
      onStart={async (id) => {
        void activateSounds();
        setLauncherError(null);
        setPendingWorkflowId(id);
        try {
          await dependencies.start(id);
        } catch (cause) {
          setLauncherError(
            cause instanceof Error ? cause.message : 'Starting failed.',
          );
        } finally {
          setPendingWorkflowId(undefined);
        }
      }}
    />
  );
}

export function FocusApp({
  dependencies,
}: Readonly<{ dependencies: FocusDependencies }>) {
  const store = useMemo(createActiveSessionStore, []);
  const projection = useStore(store);
  const [soundState, setSoundState] = useState(dependencies.sounds.getState);
  const preferences = useDocumentPreferences(dependencies.preferences);
  const reducedMotion = preferences.effectiveReducedMotion;
  const [audioError, setAudioError] = useState<string | null>(null);
  const sidePanel = useSidePanelControl(dependencies);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioRequested, setStudioRequested] = useState(false);
  const studioTriggerRef = useRef<HTMLButtonElement | null>(null);
  const studioFallbackRef = useRef<HTMLButtonElement>(null);

  async function activateSounds(): Promise<void> {
    await dependencies.sounds.unlock();
    setSoundState(dependencies.sounds.getState());
  }

  function audioSettings() {
    return {
      theme: preferences.theme,
      reducedMotion: preferences.reducedMotion,
      ambientVolumePercent: preferences.ambientVolumePercent,
      ambientMuted: preferences.ambientMuted,
      cueVolumePercent: preferences.cueVolumePercent,
      cuesMuted: preferences.cuesMuted,
      muteCuesWithMusic: preferences.muteCuesWithMusic,
      backgroundBlurPx: preferences.backgroundBlurPx,
      backgroundBrightnessPercent: preferences.backgroundBrightnessPercent,
    };
  }

  function updateAudio(patch: SettingsPatch): void {
    void activateSounds();
    setAudioError(null);
    void dependencies.updateSettings(patch).catch((cause: unknown) => {
      setAudioError(
        cause instanceof Error ? cause.message : 'Audio settings failed.',
      );
    });
  }

  function togglePanel(): void {
    void activateSounds();
    void sidePanel.toggle();
  }

  function openStudio(trigger: HTMLButtonElement): void {
    studioTriggerRef.current = trigger;
    setStudioRequested(true);
    setStudioOpen(true);
  }

  function closeStudio(): void {
    setStudioOpen(false);
    queueMicrotask(() => {
      const trigger = studioTriggerRef.current;
      if (trigger?.isConnected === true) trigger.focus();
      else studioFallbackRef.current?.focus();
    });
  }

  useEffect(() => {
    const connection = connectSessionMessages(store, dependencies.sessions);
    return () => {
      connection.disconnect();
    };
  }, [dependencies, store]);

  useCompletionCue(projection.session, dependencies.sounds);

  useEffect(() => {
    dependencies.sounds.setVolume(effectiveCueVolume(audioSettings()));
  }, [
    dependencies.sounds,
    preferences.ambientMuted,
    preferences.cueVolumePercent,
    preferences.cuesMuted,
    preferences.muteCuesWithMusic,
  ]);

  let focusSurface: ReactNode;
  if (projection.connection === 'connecting') {
    focusSurface = <p role="status">Connecting to your session…</p>;
  } else if (projection.connection === 'error') {
    focusSurface = <p role="alert">{projection.error}</p>;
  } else if (projection.session === null) {
    focusSurface = (
      <main className="focus-app focus-app--empty">
        <div className="focus-app__utility-actions">
          <Button
            buttonRef={studioFallbackRef}
            variant="quiet"
            onClick={(event) => {
              openStudio(event.currentTarget);
            }}
          >
            Open Workflow Studio
          </Button>
          <FocusAppearanceControls
            preferences={preferences}
            onUpdate={dependencies.updateSettings}
          />
          <Button
            className="focus-app__close-panel"
            variant="quiet"
            pending={sidePanel.pending}
            pendingLabel={
              sidePanel.isOpen ? 'Close side panel' : 'Open side panel'
            }
            onClick={togglePanel}
          >
            {sidePanel.isOpen ? 'Close side panel' : 'Open side panel'}
          </Button>
        </div>
        <IdleFocusLauncher
          dependencies={dependencies}
          activateSounds={activateSounds}
          openStudio={openStudio}
        />
      </main>
    );
  } else {
    const session = projection.session;
    const segment = getActiveSessionSegment(session);
    focusSurface = (
      <main className="focus-app">
        <div className="focus-app__utility-actions">
          <Button
            buttonRef={studioFallbackRef}
            variant="quiet"
            onClick={(event) => {
              openStudio(event.currentTarget);
            }}
          >
            Open Workflow Studio
          </Button>
          <FocusAppearanceControls
            preferences={preferences}
            onUpdate={dependencies.updateSettings}
          />
          <div className="focus-app__volume-control">
            <div>
              <Button
                className="focus-app__sound-toggle"
                variant="quiet"
                aria-pressed={preferences.ambientMuted}
                onClick={() => {
                  updateAudio({ ambientMuted: !preferences.ambientMuted });
                }}
              >
                {preferences.ambientMuted ? 'Unmute music' : 'Mute music'}
              </Button>
              <label>
                <span>Music volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={preferences.ambientVolumePercent}
                  onChange={(event) => {
                    updateAudio({
                      ambientVolumePercent: Number(event.currentTarget.value),
                    });
                  }}
                />
              </label>
            </div>
            <div>
              <Button
                className="focus-app__sound-toggle"
                variant="quiet"
                aria-pressed={preferences.cuesMuted}
                onClick={() => {
                  updateAudio({ cuesMuted: !preferences.cuesMuted });
                }}
              >
                {preferences.cuesMuted ? 'Unmute cues' : 'Mute cues'}
              </Button>
              <label>
                <span>Cue volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={preferences.cueVolumePercent}
                  onChange={(event) => {
                    updateAudio({
                      cueVolumePercent: Number(event.currentTarget.value),
                    });
                  }}
                />
              </label>
            </div>
          </div>
          {audioError === null ? null : <p role="alert">{audioError}</p>}
          {soundState === 'locked' ? (
            <Button
              className="focus-app__enable-sounds"
              variant="quiet"
              onClick={() => {
                void activateSounds();
              }}
            >
              Enable sounds
            </Button>
          ) : null}
          <Button
            className="focus-app__close-panel"
            variant="quiet"
            pending={sidePanel.pending}
            pendingLabel={
              sidePanel.isOpen ? 'Close side panel' : 'Open side panel'
            }
            onClick={togglePanel}
          >
            {sidePanel.isOpen ? 'Close side panel' : 'Open side panel'}
          </Button>
        </div>
        <FocusEnvironment
          environment={segment.environment}
          reducedMotion={reducedMotion}
          playing={session.status === 'running'}
          volume={effectiveAmbientVolume(audioSettings())}
          backgroundBlurPx={preferences.backgroundBlurPx}
          backgroundBrightnessPercent={preferences.backgroundBrightnessPercent}
          loadAssetUrl={dependencies.loadAssetUrl}
          releaseAssetUrl={dependencies.releaseAssetUrl}
        />
        <div className="focus-app__content">
          <ActiveSessionView
            session={session}
            dialogsEnabled={!studioOpen}
            reducedMotion={reducedMotion}
            onPhaseBoundary={dependencies.sounds.playBell}
            rewardInteraction={{
              onRoll: dependencies.sounds.playDiceRoll,
              rollReward: dependencies.rollReward,
              rerollReward: dependencies.rerollReward,
              continueReward: dependencies.continueReward,
            }}
            onPause={async (id) => {
              void activateSounds();
              await dependencies.pause(id);
            }}
            onResume={async (id) => {
              void activateSounds();
              await dependencies.resume(id);
            }}
            onRestart={dependencies.restartPhase}
            onStop={async (id) => {
              void activateSounds();
              await dependencies.stop(id);
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <div className="focus-document">
      <div
        className="focus-app-surface"
        inert={studioOpen ? true : undefined}
        aria-hidden={studioOpen ? true : undefined}
      >
        {focusSurface}
      </div>
      {studioRequested ? (
        <WorkflowStudioOverlay
          open={studioOpen}
          reducedMotion={reducedMotion}
          session={
            projection.connection === 'connected' ? projection.session : null
          }
          onClose={closeStudio}
        >
          <LazyWorkflowStudio loadDependencies={dependencies.loadStudio} />
        </WorkflowStudioOverlay>
      ) : null}
    </div>
  );
}
