import { useState } from 'react';

import type { Workflow, WorkflowId } from '@/features/workflow';
import { Button } from '@/shared';

type SidePanelWorkflowChooserProps = Readonly<{
  workflows: readonly Workflow[];
  onOpenStudio(): Promise<void>;
  onOpen(id: WorkflowId): void;
  onStart(id: WorkflowId): Promise<void>;
}>;

export function SidePanelWorkflowChooser({
  workflows,
  onOpenStudio,
  onOpen,
  onStart,
}: SidePanelWorkflowChooserProps) {
  const [pendingWorkflowId, setPendingWorkflowId] = useState<WorkflowId | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [openingStudio, setOpeningStudio] = useState(false);

  const groups = (['quick', 'detailed'] as const).flatMap((mode) => {
    const values = workflows.filter((workflow) => workflow.mode === mode);
    return values.length === 0 ? [] : [{ mode, values }];
  });

  if (workflows.length === 0) {
    return (
      <section className="side-panel-workflow-chooser side-panel-workflow-chooser--empty">
        <h2>Build your first focus rhythm.</h2>
        <p>Create a Workflow in Workflow Studio to start focusing.</p>
        <Button
          variant="primary"
          pending={openingStudio}
          pendingLabel="Opening…"
          onClick={() => {
            setError(null);
            setOpeningStudio(true);
            void onOpenStudio()
              .catch((cause: unknown) => {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : 'Workflow Studio unavailable.',
                );
              })
              .finally(() => {
                setOpeningStudio(false);
              });
          }}
        >
          Open Workflow Studio
        </Button>
        {error === null ? null : (
          <p className="feedback feedback--error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      className="side-panel-workflow-chooser"
      aria-labelledby="side-panel-workflows-title"
    >
      <div className="side-panel-workflow-chooser__header">
        <h2 id="side-panel-workflows-title">Workflows</h2>
        <p>Choose a rhythm to start or open it in Workflow Studio.</p>
      </div>

      {error === null ? null : (
        <p className="feedback feedback--error" role="alert">
          {error}
        </p>
      )}

      {groups.map(({ mode, values }) => {
        const label = mode === 'quick' ? 'Quick' : 'Detailed';
        return (
          <div
            className="side-panel-workflow-group"
            role="group"
            aria-label={`${label} Workflows`}
            key={mode}
          >
            <h3>{label}</h3>
            <ol className="side-panel-workflow-list">
              {values.map((workflow) => (
                <li className="side-panel-workflow-item" key={workflow.id}>
                  <button
                    className="side-panel-workflow-item__open"
                    type="button"
                    aria-label={`Open ${workflow.name}`}
                    onClick={() => {
                      onOpen(workflow.id);
                    }}
                  >
                    <strong>{workflow.name}</strong>
                    <span>
                      {String(workflow.phases.length)}{' '}
                      {workflow.phases.length === 1 ? 'phase' : 'phases'}
                      {' · '}Reward{' '}
                      {workflow.rewardDice === undefined ? 'off' : 'on'}
                    </span>
                  </button>
                  <div className="side-panel-workflow-item__actions">
                    <Button
                      variant="primary"
                      aria-label={`Start workflow: ${workflow.name}`}
                      pending={pendingWorkflowId === workflow.id}
                      pendingLabel="Starting…"
                      onClick={() => {
                        setError(null);
                        setPendingWorkflowId(workflow.id);
                        void onStart(workflow.id)
                          .catch((cause: unknown) => {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : 'Starting failed.',
                            );
                          })
                          .finally(() => {
                            setPendingWorkflowId(null);
                          });
                      }}
                    >
                      Start workflow
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
