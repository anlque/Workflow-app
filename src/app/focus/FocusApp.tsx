import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import {
  ActiveSessionView,
  connectSessionMessages,
  createActiveSessionStore,
  type SessionId,
  type SessionProjectionClient,
} from '@/features/session';
import type { AssetId } from '@/features/assets';
import {
  useWorkflowCatalog,
  type Workflow,
  type WorkflowCatalogSource,
  type WorkflowId,
} from '@/features/workflow';
import { Button } from '@/shared';
import type { DocumentPreferences } from '@/app/document-preferences/DocumentPreferences';
import { useDocumentPreferences } from '@/app/document-preferences/useDocumentPreferences';

import { FocusEnvironment } from './FocusEnvironment';
import { FocusLauncher } from './FocusLauncher';
import type { UiSoundPlayer } from './createUiSoundPlayer';
import { useCompletionCue } from './useCompletionCue';

export type FocusDependencies = Readonly<{
  preferences: DocumentPreferences;
  sounds: UiSoundPlayer;
  sessions: SessionProjectionClient;
  pause(id: SessionId): Promise<void>;
  resume(id: SessionId): Promise<void>;
  continueReward(id: SessionId): Promise<void>;
  stop(id: SessionId): Promise<void>;
  loadAssetUrl(id: AssetId): Promise<string | null>;
  releaseAssetUrl(url: string): void;
  closeSidePanel(): Promise<void>;
  openSidePanel(): Promise<void>;
  subscribeSidePanelState(listener: (open: boolean) => void): () => void;
  listWorkflows(): Promise<readonly Workflow[]>;
  subscribeWorkflowChanges(listener: () => void): () => void;
  start(id: WorkflowId): Promise<void>;
  openOptions(): Promise<void>;
}>;

function IdleFocusLauncher({
  dependencies,
  activateSounds,
}: Readonly<{
  dependencies: FocusDependencies;
  activateSounds(): Promise<void>;
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
      onOpenOptions={dependencies.openOptions}
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
  const [volumePercent, setVolumePercent] = useState(100);
  const lastAudibleVolumeRef = useRef(100);
  const { effectiveReducedMotion: reducedMotion } = useDocumentPreferences(
    dependencies.preferences,
  );
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [panelPending, setPanelPending] = useState(false);

  async function activateSounds(): Promise<void> {
    await dependencies.sounds.unlock();
    setSoundState(dependencies.sounds.getState());
  }

  function updateVolume(nextVolumePercent: number): void {
    const normalizedVolume = Math.min(100, Math.max(0, nextVolumePercent));
    if (normalizedVolume > 0) lastAudibleVolumeRef.current = normalizedVolume;
    setVolumePercent(normalizedVolume);
    dependencies.sounds.setVolume(normalizedVolume / 100);
  }

  function toggleSound(): void {
    void activateSounds();
    updateVolume(volumePercent === 0 ? lastAudibleVolumeRef.current : 0);
  }

  function togglePanel(): void {
    if (panelPending) return;
    void activateSounds();
    const wasOpen = sidePanelOpen;
    const action = wasOpen
      ? dependencies.closeSidePanel
      : dependencies.openSidePanel;
    setSidePanelOpen(!wasOpen);
    setPanelPending(true);
    void action().then(
      () => {
        setPanelPending(false);
      },
      () => {
        setSidePanelOpen(wasOpen);
        setPanelPending(false);
      },
    );
  }

  useEffect(() => {
    const connection = connectSessionMessages(store, dependencies.sessions);
    return () => {
      connection.disconnect();
    };
  }, [dependencies, store]);

  useEffect(
    () => dependencies.subscribeSidePanelState(setSidePanelOpen),
    [dependencies],
  );

  const scheduleCompletionReveal = useCompletionCue(
    projection.session,
    dependencies.sounds,
  );

  if (projection.connection === 'connecting') {
    return <p role="status">Connecting to your session…</p>;
  }
  if (projection.connection === 'error') {
    return <p role="alert">{projection.error}</p>;
  }
  if (projection.session === null) {
    return (
      <main className="focus-app focus-app--empty">
        <div className="focus-app__utility-actions">
          <Button
            className="focus-app__close-panel"
            variant="quiet"
            disabled={panelPending}
            aria-busy={panelPending || undefined}
            onClick={togglePanel}
          >
            {sidePanelOpen ? 'Close side panel' : 'Open side panel'}
          </Button>
        </div>
        <IdleFocusLauncher
          dependencies={dependencies}
          activateSounds={activateSounds}
        />
      </main>
    );
  }

  const session = projection.session;
  const phase =
    session.snapshot.workflow.phases[session.currentPhaseIndex] ??
    session.snapshot.workflow.phases[0];
  return (
    <main className="focus-app">
      <div className="focus-app__utility-actions">
        <div className="focus-app__volume-control">
          <Button
            className="focus-app__sound-toggle"
            variant="quiet"
            aria-pressed={volumePercent === 0}
            onClick={toggleSound}
          >
            {volumePercent === 0 ? 'Unmute sound' : 'Mute sound'}
          </Button>
          <label>
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={volumePercent}
              onChange={(event) => {
                updateVolume(Number(event.currentTarget.value));
              }}
            />
          </label>
        </div>
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
          disabled={panelPending}
          aria-busy={panelPending || undefined}
          onClick={togglePanel}
        >
          {sidePanelOpen ? 'Close side panel' : 'Open side panel'}
        </Button>
      </div>
      <FocusEnvironment
        environment={phase.environment}
        reducedMotion={reducedMotion}
        playing={session.status === 'running'}
        volume={volumePercent / 100}
        loadAssetUrl={dependencies.loadAssetUrl}
        releaseAssetUrl={dependencies.releaseAssetUrl}
      />
      <div className="focus-app__content">
        <ActiveSessionView
          session={session}
          reducedMotion={reducedMotion}
          onPhaseBoundary={dependencies.sounds.playBell}
          onFinalRewardContinued={scheduleCompletionReveal}
          rewardInteraction={{
            onRoll: dependencies.sounds.playDiceRoll,
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
          onStop={async (id) => {
            void activateSounds();
            await dependencies.stop(id);
          }}
        />
      </div>
    </main>
  );
}
