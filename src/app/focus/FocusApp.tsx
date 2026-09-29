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
  useWorkflowCatalog,
  type Workflow,
  type WorkflowCatalogSource,
  type WorkflowId,
} from '@/features/workflow';
import { Button } from '@/shared';
import type { DocumentPreferences } from '@/app/document-preferences/DocumentPreferences';
import { useDocumentPreferences } from '@/app/document-preferences/useDocumentPreferences';
import type { WorkflowStudioDependencies } from '../workflow-studio/WorkflowStudio';

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
  const [volumePercent, setVolumePercent] = useState(100);
  const lastAudibleVolumeRef = useRef(100);
  const { effectiveReducedMotion: reducedMotion } = useDocumentPreferences(
    dependencies.preferences,
  );
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [panelPending, setPanelPending] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioRequested, setStudioRequested] = useState(false);
  const studioTriggerRef = useRef<HTMLButtonElement | null>(null);
  const studioFallbackRef = useRef<HTMLButtonElement>(null);

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

  useEffect(
    () => dependencies.subscribeSidePanelState(setSidePanelOpen),
    [dependencies],
  );

  useCompletionCue(projection.session, dependencies.sounds);

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
          environment={segment.environment}
          reducedMotion={reducedMotion}
          playing={session.status === 'running'}
          volume={volumePercent / 100}
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
