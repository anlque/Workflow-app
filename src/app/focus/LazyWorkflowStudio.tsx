import { useEffect, useState } from 'react';

import { WorkflowStudio } from '../workflow-studio/WorkflowStudio';
import type { WorkflowStudioDependencies } from '../workflow-studio/WorkflowStudio';

export type LazyWorkflowStudioProps = Readonly<{
  loadDependencies(): Promise<WorkflowStudioDependencies>;
}>;

export default function LazyWorkflowStudio({
  loadDependencies,
}: LazyWorkflowStudioProps) {
  const [dependencies, setDependencies] =
    useState<WorkflowStudioDependencies | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    void loadDependencies().then(
      (loaded) => {
        if (active) setDependencies(loaded);
      },
      (cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause
              : new Error('Loading Workflow Studio failed.'),
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [loadDependencies]);

  if (error !== null) throw error;
  if (dependencies === null) {
    return <p role="status">Loading Workflow Studio…</p>;
  }
  return <WorkflowStudio dependencies={dependencies} />;
}
