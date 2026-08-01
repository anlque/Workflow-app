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
import { Button } from '@/shared';

import { FocusEnvironment } from './FocusEnvironment';

export type FocusDependencies = Readonly<{
  sessions: SessionProjectionClient;
  pause(id: SessionId): Promise<void>;
  resume(id: SessionId): Promise<void>;
  stop(id: SessionId): Promise<void>;
  loadAssetUrl(id: AssetId): Promise<string | null>;
  releaseAssetUrl(url: string): void;
  loadReducedMotion(): Promise<boolean>;
  closeSidePanel(): Promise<void>;
  openSidePanel(): Promise<void>;
  subscribeSidePanelState(listener: (open: boolean) => void): () => void;
}>;

export function FocusApp({
  dependencies,
}: Readonly<{ dependencies: FocusDependencies }>) {
  const store = useMemo(createActiveSessionStore, []);
  const projection = useStore(store);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [panelPending, setPanelPending] = useState(false);

  function togglePanel(): void {
    if (panelPending) return;
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
      <main className="focus-app focus-app--empty">
        <h1>No active session</h1>
        <p>Start a Workflow from the Flowarium side panel.</p>
        <Button
          variant="quiet"
          disabled={panelPending}
          aria-busy={panelPending || undefined}
          onClick={togglePanel}
        >
          {sidePanelOpen ? 'Close side panel' : 'Open side panel'}
        </Button>
      </main>
    );
  }

  const session = projection.session;
  const phase =
    session.snapshot.workflow.phases[session.currentPhaseIndex] ??
    session.snapshot.workflow.phases[0];
  return (
    <main className="focus-app">
      <Button
        className="focus-app__close-panel"
        variant="quiet"
        disabled={panelPending}
        aria-busy={panelPending || undefined}
        onClick={togglePanel}
      >
        {sidePanelOpen ? 'Close side panel' : 'Open side panel'}
      </Button>
      <FocusEnvironment
        environment={phase.environment}
        reducedMotion={reducedMotion}
        loadAssetUrl={dependencies.loadAssetUrl}
        releaseAssetUrl={dependencies.releaseAssetUrl}
      />
      <div className="focus-app__content">
        <ActiveSessionView
          session={session}
          onPause={dependencies.pause}
          onResume={dependencies.resume}
          onStop={dependencies.stop}
        />
      </div>
    </main>
  );
}
