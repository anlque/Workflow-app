import { useEffect, useMemo, useState } from 'react';
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

import { FocusEnvironment } from './FocusEnvironment';
import { FocusLauncher } from './FocusLauncher';
import type { UiSoundPlayer } from './createUiSoundPlayer';

export type FocusDependencies = Readonly<{
  sounds: UiSoundPlayer;
  sessions: SessionProjectionClient;
  pause(id: SessionId): Promise<void>;
  resume(id: SessionId): Promise<void>;
  continueReward(id: SessionId): Promise<void>;
  stop(id: SessionId): Promise<void>;
  loadAssetUrl(id: AssetId): Promise<string | null>;
  releaseAssetUrl(url: string): void;
  loadReducedMotion(): Promise<boolean>;
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [panelPending, setPanelPending] = useState(false);

  async function activateSounds(): Promise<void> {
    await dependencies.sounds.unlock();
    setSoundState(dependencies.sounds.getState());
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
    let active = true;
    void dependencies.loadReducedMotion().then((value) => {
      if (active) setReducedMotion(value);
    });
    return () => {
      active = false;
      connection.disconnect();
    };
  }, [dependencies, store]);

  useEffect(
    () => dependencies.subscribeSidePanelState(setSidePanelOpen),
    [dependencies],
  );

  if (projection.connection === 'connecting') {
    return <p role="status">Connecting to your session…</p>;
  }
  if (projection.connection === 'error') {
    return <p role="alert">{projection.error}</p>;
  }
  if (projection.session === null) {
    return (
      <main
        className="focus-app focus-app--empty"
        data-reduced-motion={String(reducedMotion)}
      >
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
    <main className="focus-app" data-reduced-motion={String(reducedMotion)}>
      <div className="focus-app__utility-actions">
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
        loadAssetUrl={dependencies.loadAssetUrl}
        releaseAssetUrl={dependencies.releaseAssetUrl}
      />
      <div className="focus-app__content">
        <ActiveSessionView
          session={session}
          reducedMotion={reducedMotion}
          onPhaseBoundary={dependencies.sounds.playBell}
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
