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
  useWorkflowCatalog,
  type Workflow,
  type WorkflowCatalogSource,
  type WorkflowId,
} from '@/features/workflow';

export type SidePanelDependencies = Readonly<{
  listWorkflows(): Promise<readonly Workflow[]>;
  subscribeWorkflowChanges(listener: () => void): () => void;
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
  const [error, setError] = useState<string | null>(null);
  const sessionStore = useMemo(createActiveSessionStore, []);
  const projection = useStore(sessionStore);
  const workflowCatalog = useMemo<WorkflowCatalogSource>(
    () => ({
      list: dependencies.listWorkflows,
      subscribeInvalidation: dependencies.subscribeWorkflowChanges,
    }),
    [dependencies],
  );
  const { workflows, refreshError, reload } =
    useWorkflowCatalog(workflowCatalog);

  useEffect(() => {
    const connection = connectSessionMessages(
      sessionStore,
      dependencies.sessions,
    );
    return connection.disconnect;
  }, [dependencies.sessions, sessionStore]);

  if (error !== null || (workflows === null && refreshError !== null)) {
    return (
      <p className="feedback feedback--error" role="alert">
        {error ?? refreshError}
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
        <>
          {refreshError === null ? null : (
            <p className="feedback feedback--error" role="alert">
              {refreshError}
            </p>
          )}
          <WorkflowLibrary
            workflows={workflows}
            onCreate={async () => {
              await dependencies.createWorkflow();
              await reload();
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
              await reload();
            }}
            onDelete={async (id) => {
              await dependencies.deleteWorkflow(id);
              await reload();
            }}
            onReorder={async (ids) => {
              await dependencies.reorderWorkflows(ids);
              await reload();
            }}
            onStart={async (id) => {
              await dependencies.startSession(id);
              await dependencies.openFocusView();
            }}
          />
        </>
      ) : null}
    </main>
  );
}
