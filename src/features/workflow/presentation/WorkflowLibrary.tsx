import { useState } from 'react';

import { Button, Dialog } from '@/shared';

import type { Workflow, WorkflowId } from '../domain/Workflow';

export type WorkflowLibraryProps = Readonly<{
  workflows: readonly Workflow[];
  selectedWorkflowId?: WorkflowId;
  busyWorkflowId?: WorkflowId;
  onCreate(): Promise<void>;
  onOpen(id: WorkflowId): void;
  onDuplicate(id: WorkflowId): Promise<void>;
  onDelete(id: WorkflowId): Promise<void>;
  onReorder(ids: readonly WorkflowId[]): Promise<void>;
}>;

export function WorkflowLibrary({
  workflows,
  selectedWorkflowId,
  busyWorkflowId,
  onCreate,
  onOpen,
  onDuplicate,
  onDelete,
  onReorder,
}: WorkflowLibraryProps) {
  const [deleting, setDeleting] = useState<Workflow | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function perform(
    key: string,
    action: () => Promise<void>,
  ): Promise<boolean> {
    setError(null);
    setPendingAction(key);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action failed.');
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  function reordered(index: number, offset: -1 | 1): readonly WorkflowId[] {
    const ids = workflows.map(({ id }) => id);
    const target = index + offset;
    const current = ids[index];
    const destination = ids[target];
    if (current === undefined || destination === undefined) return ids;
    ids[index] = destination;
    ids[target] = current;
    return ids;
  }

  if (workflows.length === 0) {
    return (
      <section className="workflow-library workflow-library--empty">
        <div>
          <h2>Build your first focus rhythm.</h2>
          <p>
            Combine focus, breaks, sound and atmosphere into a Workflow you can
            return to.
          </p>
        </div>
        <Button
          variant="primary"
          pending={pendingAction === 'create'}
          pendingLabel="Creating…"
          onClick={() => void perform('create', onCreate)}
        >
          Create workflow
        </Button>
        {error === null ? null : <p role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section
      className="workflow-library"
      aria-labelledby="workflow-library-title"
    >
      <div className="workflow-library__header">
        <div>
          <h2 id="workflow-library-title">Workflows</h2>
          <p>Choose a rhythm or shape a new one.</p>
        </div>
        <Button
          variant="primary"
          pending={pendingAction === 'create'}
          pendingLabel="Creating…"
          onClick={() => void perform('create', onCreate)}
        >
          New workflow
        </Button>
      </div>

      {error === null || deleting !== null ? null : (
        <p className="feedback feedback--error" role="alert">
          {error}
        </p>
      )}

      <ol className="workflow-list">
        {workflows.map((workflow, index) => {
          const externallyBusy = busyWorkflowId === workflow.id;
          return (
            <li
              className="workflow-list__item"
              key={workflow.id}
              aria-current={
                selectedWorkflowId === workflow.id ? 'true' : undefined
              }
            >
              <button
                className="workflow-list__open"
                type="button"
                onClick={() => {
                  onOpen(workflow.id);
                }}
                aria-label={`Open ${workflow.name}`}
              >
                <strong>{workflow.name}</strong>
                <span>
                  {String(workflow.phases.length)}{' '}
                  {workflow.phases.length === 1 ? 'phase' : 'phases'}
                </span>
              </button>
              <div className="workflow-list__actions">
                <Button
                  variant="quiet"
                  aria-label={`Move ${workflow.name} up`}
                  disabled={index === 0 || externallyBusy}
                  pending={pendingAction === `up:${workflow.id}`}
                  pendingLabel="Moving…"
                  onClick={() =>
                    void perform(`up:${workflow.id}`, () =>
                      onReorder(reordered(index, -1)),
                    )
                  }
                >
                  Move up
                </Button>
                <Button
                  variant="quiet"
                  aria-label={`Move ${workflow.name} down`}
                  disabled={index === workflows.length - 1 || externallyBusy}
                  pending={pendingAction === `down:${workflow.id}`}
                  pendingLabel="Moving…"
                  onClick={() =>
                    void perform(`down:${workflow.id}`, () =>
                      onReorder(reordered(index, 1)),
                    )
                  }
                >
                  Move down
                </Button>
                <Button
                  variant="quiet"
                  aria-label={`Duplicate ${workflow.name}`}
                  disabled={externallyBusy}
                  pending={pendingAction === `duplicate:${workflow.id}`}
                  pendingLabel="Duplicating…"
                  onClick={() =>
                    void perform(`duplicate:${workflow.id}`, () =>
                      onDuplicate(workflow.id),
                    )
                  }
                >
                  Duplicate
                </Button>
                <Button
                  variant="quiet"
                  aria-label={`Delete ${workflow.name}`}
                  disabled={externallyBusy}
                  onClick={() => {
                    setDeleting(workflow);
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <Dialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'Workflow'}?`}
        onCancel={() => {
          setDeleting(null);
        }}
      >
        <p>This removes the Workflow. Shared Assets remain in your library.</p>
        {error === null ? null : (
          <p className="feedback feedback--error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button
            variant="quiet"
            onClick={() => {
              setDeleting(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={
              deleting !== null && pendingAction === `delete:${deleting.id}`
            }
            pendingLabel="Deleting…"
            onClick={() => {
              if (deleting === null) return;
              const target = deleting;
              void perform(`delete:${target.id}`, () =>
                onDelete(target.id),
              ).then((succeeded) => {
                if (succeeded) setDeleting(null);
              });
            }}
          >
            Delete workflow
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
