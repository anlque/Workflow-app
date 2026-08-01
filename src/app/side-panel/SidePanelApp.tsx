import { useEffect, useState } from 'react';

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
}>;

export function SidePanelApp({
  dependencies,
}: Readonly<{ dependencies: SidePanelDependencies }>) {
  const [workflows, setWorkflows] = useState<readonly Workflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error !== null) {
    return (
      <p className="feedback feedback--error" role="alert">
        {error}
      </p>
    );
  }
  if (workflows === null) return <p role="status">Loading Workflows…</p>;

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
      />
    </main>
  );
}
