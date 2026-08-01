import type { Workflow, WorkflowId } from '@/features/workflow';
import { Button } from '@/shared';

export type FocusLauncherProps = Readonly<{
  workflows: readonly Workflow[] | null;
  error: string | null;
  pendingWorkflowId?: WorkflowId | undefined;
  onStart(id: WorkflowId): Promise<void>;
  onOpenOptions(): Promise<void>;
}>;

export function FocusLauncher({
  workflows,
  error,
  pendingWorkflowId,
  onStart,
  onOpenOptions,
}: FocusLauncherProps) {
  return (
    <section className="focus-launcher" aria-labelledby="focus-launcher-title">
      <div>
        <h1 id="focus-launcher-title">Choose a Workflow</h1>
        <p>Start a focus rhythm without leaving this tab.</p>
      </div>
      {error === null ? null : (
        <p className="feedback feedback--error" role="alert">
          {error}
        </p>
      )}
      {workflows === null ? (
        <p role="status">Loading Workflows…</p>
      ) : workflows.length === 0 ? (
        <div className="focus-launcher__empty">
          <p>No Workflows yet</p>
          <Button variant="primary" onClick={() => void onOpenOptions()}>
            Create a Workflow
          </Button>
        </div>
      ) : (
        <ol className="focus-launcher__list">
          {workflows.map((workflow) => (
            <li key={workflow.id}>
              <div>
                <strong>{workflow.name}</strong>
                <span>
                  {String(workflow.phases.length)}{' '}
                  {workflow.phases.length === 1 ? 'phase' : 'phases'}
                </span>
              </div>
              <Button
                variant="primary"
                pending={pendingWorkflowId === workflow.id}
                pendingLabel="Starting…"
                disabled={
                  pendingWorkflowId !== undefined &&
                  pendingWorkflowId !== workflow.id
                }
                onClick={() => void onStart(workflow.id)}
              >
                Start {workflow.name}
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
