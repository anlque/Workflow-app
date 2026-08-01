import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import {
  ActiveSessionView,
  connectSessionMessages,
  createActiveSessionStore,
  type SessionId,
  type SessionProjectionClient,
} from '@/features/session';
import { Button } from '@/shared';

import {
  WorkflowLibrary,
  type Workflow,
  type WorkflowId,
} from '@/features/workflow';

export type SidePanelDependencies = Readonly<{
  listWorkflows(): Promise<readonly Workflow[]>;
  createWorkflow(): Promise<void>;
  duplicateWorkflow(id: WorkflowId): Promise<void>;
  deleteWorkflow(id: WorkflowId): Promise<void>;
  reorderWorkflows(ids: readonly WorkflowId[]): Promise<void>;
  openWorkflow(id: WorkflowId): Promise<void>;
  sessions: SessionProjectionClient;
  startSession(id: WorkflowId): Promise<void>;
  pauseSession(id: SessionId): Promise<void>;
  resumeSession(id: SessionId): Promise<void>;
  stopSession(id: SessionId): Promise<void>;
  openFocusView(): Promise<void>;
}>;

export function SidePanelApp({
  dependencies,
}: Readonly<{ dependencies: SidePanelDependencies }>) {
  const [workflows, setWorkflows] = useState<readonly Workflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionStore = useMemo(createActiveSessionStore, []);
  const projection = useStore(sessionStore);

  async function load(): Promise<void> {
    setWorkflows(await dependencies.listWorkflows());
  }

  useEffect(() => {
    let active = true;
    void dependencies.listWorkflows().then(
      (values) => {
        if (active) setWorkflows(values);
      },
      (cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Loading failed.');
        }
      },
    );
    return () => {
      active = false;
    };
  }, [dependencies]);

  useEffect(() => {
    const connection = connectSessionMessages(
      sessionStore,
      dependencies.sessions,
    );
    return connection.disconnect;
  }, [dependencies.sessions, sessionStore]);

  if (error !== null) {
    return (
      <p className="feedback feedback--error" role="alert">
        {error}
      </p>
    );
  }
  if (workflows === null) return <p role="status">Loading Workflows…</p>;

  const activeSession = projection.session;

  return (
    <main className="side-panel-app">
      <header className="side-panel-header">
        <span className="brand-mark" aria-hidden="true">
          F
        </span>
        <div>
          <h1>Flowarium</h1>
          <p>Your focus rhythms</p>
        </div>
      </header>
      {activeSession === null ? null : (
        <section className="side-panel-session" aria-label="Active session">
          <ActiveSessionView
            session={activeSession}
            onPause={dependencies.pauseSession}
            onResume={dependencies.resumeSession}
            onStop={dependencies.stopSession}
          />
          <Button
            variant="primary"
            onClick={() => {
              void dependencies.openFocusView();
            }}
          >
            Open focus view
          </Button>
        </section>
      )}
      {activeSession === null ? (
        <WorkflowLibrary
          workflows={workflows}
          onCreate={async () => {
            await dependencies.createWorkflow();
            await load();
          }}
          onOpen={(id) => {
            void dependencies.openWorkflow(id).catch((cause: unknown) => {
              setError(
                cause instanceof Error ? cause.message : 'Opening failed.',
              );
            });
          }}
          onDuplicate={async (id) => {
            await dependencies.duplicateWorkflow(id);
            await load();
          }}
          onDelete={async (id) => {
            await dependencies.deleteWorkflow(id);
            await load();
          }}
          onReorder={async (ids) => {
            await dependencies.reorderWorkflows(ids);
            await load();
          }}
          onStart={async (id) => {
            await dependencies.startSession(id);
            await dependencies.openFocusView();
          }}
        />
      ) : null}
    </main>
  );
}
