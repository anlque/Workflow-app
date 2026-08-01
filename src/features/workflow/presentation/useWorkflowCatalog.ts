import { useCallback, useEffect, useRef, useState } from 'react';

import type { Workflow } from '../domain/Workflow';

export type WorkflowCatalogSource = Readonly<{
  list(): Promise<readonly Workflow[]>;
  subscribeInvalidation(listener: () => void): () => void;
}>;

export type WorkflowCatalogState = Readonly<{
  workflows: readonly Workflow[] | null;
  refreshError: string | null;
  reload(): Promise<void>;
}>;

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : 'Workflow catalog refresh failed.';
}

export function useWorkflowCatalog(
  source: WorkflowCatalogSource,
): WorkflowCatalogState {
  const [workflows, setWorkflows] = useState<readonly Workflow[] | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const active = useRef(false);
  const reloadQueued = useRef(false);
  const reloadInFlight = useRef<Promise<void> | null>(null);

  const reload = useCallback((): Promise<void> => {
    reloadQueued.current = true;
    if (reloadInFlight.current !== null) return reloadInFlight.current;

    const drain = async (): Promise<void> => {
      const isActive = (): boolean => active.current;
      while (isActive() && reloadQueued.current) {
        reloadQueued.current = false;
        try {
          const values = await source.list();
          if (isActive()) {
            setWorkflows(values);
            setRefreshError(null);
          }
        } catch (cause) {
          if (isActive()) setRefreshError(errorMessage(cause));
        }
      }
    };

    const pending = drain().finally(() => {
      if (reloadInFlight.current === pending) reloadInFlight.current = null;
    });
    reloadInFlight.current = pending;
    return pending;
  }, [source]);

  useEffect(() => {
    active.current = true;
    const unsubscribe = source.subscribeInvalidation(() => {
      void reload();
    });
    void reload();
    return () => {
      active.current = false;
      reloadQueued.current = false;
      unsubscribe();
    };
  }, [reload, source]);

  return { workflows, refreshError, reload };
}
