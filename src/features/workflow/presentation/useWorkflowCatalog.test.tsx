import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '../domain/createWorkflow';
import {
  useWorkflowCatalog,
  type WorkflowCatalogSource,
} from './useWorkflowCatalog';

function workflow(id: string, name: string) {
  return createWorkflow({
    id,
    name,
    phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function catalogSource(list: WorkflowCatalogSource['list']) {
  const listeners = new Set<() => void>();
  const unsubscribe = vi.fn();
  return {
    source: {
      list,
      subscribeInvalidation(listener: () => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
          unsubscribe();
        };
      },
    } satisfies WorkflowCatalogSource,
    invalidate() {
      for (const listener of listeners) listener();
    },
    unsubscribe,
  };
}

describe('useWorkflowCatalog', () => {
  test('loads the initial Workflow list', async () => {
    const expected = [workflow('workflow-1', 'Deep work')];
    const catalog = catalogSource(() => Promise.resolve(expected));

    const { result } = renderHook(() => useWorkflowCatalog(catalog.source));

    await waitFor(() => {
      expect(result.current.workflows).toEqual(expected);
    });
    expect(result.current.refreshError).toBeNull();
  });

  test('reloads an already visible list after invalidation', async () => {
    const initial = [workflow('workflow-1', 'Deep work')];
    const refreshed = [workflow('workflow-1', 'Renamed work')];
    const list = vi
      .fn<WorkflowCatalogSource['list']>()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(refreshed);
    const catalog = catalogSource(list);
    const { result } = renderHook(() => useWorkflowCatalog(catalog.source));
    await waitFor(() => {
      expect(result.current.workflows).toEqual(initial);
    });

    act(() => {
      catalog.invalidate();
    });

    await waitFor(() => {
      expect(result.current.workflows).toEqual(refreshed);
    });
  });

  test('preserves valid values on failure and retries on a later event', async () => {
    const initial = [workflow('workflow-1', 'Deep work')];
    const recovered = [workflow('workflow-1', 'Recovered work')];
    const list = vi
      .fn<WorkflowCatalogSource['list']>()
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error('Database unavailable'))
      .mockResolvedValueOnce(recovered);
    const catalog = catalogSource(list);
    const { result } = renderHook(() => useWorkflowCatalog(catalog.source));
    await waitFor(() => {
      expect(result.current.workflows).toEqual(initial);
    });

    act(() => {
      catalog.invalidate();
    });
    await waitFor(() => {
      expect(result.current.refreshError).toBe('Database unavailable');
    });
    expect(result.current.workflows).toEqual(initial);

    act(() => {
      catalog.invalidate();
    });
    await waitFor(() => {
      expect(result.current.workflows).toEqual(recovered);
    });
    expect(result.current.refreshError).toBeNull();
  });

  test('coalesces invalidations during a pending read into one follow-up read', async () => {
    const initial = deferred<readonly ReturnType<typeof workflow>[]>();
    const refreshed = deferred<readonly ReturnType<typeof workflow>[]>();
    const list = vi
      .fn<WorkflowCatalogSource['list']>()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(refreshed.promise);
    const catalog = catalogSource(list);
    const { result } = renderHook(() => useWorkflowCatalog(catalog.source));

    act(() => {
      catalog.invalidate();
      catalog.invalidate();
    });
    expect(list).toHaveBeenCalledTimes(1);

    await act(async () => {
      initial.resolve([workflow('workflow-1', 'Initial')]);
      await initial.promise;
    });
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      refreshed.resolve([workflow('workflow-1', 'Refreshed')]);
      await refreshed.promise;
    });
    await waitFor(() => {
      expect(result.current.workflows?.[0]?.name).toBe('Refreshed');
    });
    expect(list).toHaveBeenCalledTimes(2);
  });

  test('unsubscribes and ignores pending results after unmount', async () => {
    const pending = deferred<readonly ReturnType<typeof workflow>[]>();
    const catalog = catalogSource(() => pending.promise);
    const { result, unmount } = renderHook(() =>
      useWorkflowCatalog(catalog.source),
    );

    unmount();
    pending.resolve([workflow('workflow-1', 'Late')]);
    await pending.promise;

    expect(catalog.unsubscribe).toHaveBeenCalledOnce();
    expect(result.current.workflows).toBeNull();
  });
});
