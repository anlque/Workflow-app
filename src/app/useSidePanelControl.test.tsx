import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { useSidePanelControl } from './useSidePanelControl';

function deferred(): {
  promise: Promise<void>;
  resolve(): void;
  reject(cause: unknown): void;
} {
  let resolve!: () => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function setup() {
  let listener: ((open: boolean) => void) | undefined;
  const unsubscribe = vi.fn();
  const dependencies = {
    openSidePanel: vi.fn(() => Promise.resolve()),
    closeSidePanel: vi.fn(() => Promise.resolve()),
    subscribeSidePanelState: vi.fn((next: (open: boolean) => void) => {
      listener = next;
      return unsubscribe;
    }),
  };
  const hook = renderHook(() => useSidePanelControl(dependencies));
  return {
    ...hook,
    dependencies,
    unsubscribe,
    emit: (open: boolean) => {
      act(() => listener?.(open));
    },
  };
}

describe('useSidePanelControl', () => {
  test('optimistically opens and closes through one shared controller', async () => {
    const { result, dependencies, emit } = setup();

    await act(async () => result.current.toggle());
    expect(dependencies.openSidePanel).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({ isOpen: true, pending: false });

    emit(true);
    await act(async () => result.current.toggle());
    expect(dependencies.closeSidePanel).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({ isOpen: false, pending: false });
  });

  test('guards synchronous double clicks while the first action is pending', async () => {
    const pending = deferred();
    const { result, dependencies } = setup();
    dependencies.openSidePanel.mockReturnValueOnce(pending.promise);

    act(() => {
      void result.current.toggle();
      void result.current.toggle();
    });
    expect(dependencies.openSidePanel).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({ isOpen: true, pending: true });

    act(() => {
      pending.resolve();
    });
    await act(() => Promise.resolve());
    expect(result.current.pending).toBe(false);
  });

  test('rolls back an action error, exposes it and allows retry', async () => {
    const { result, dependencies } = setup();
    dependencies.openSidePanel
      .mockRejectedValueOnce(new Error('Opening failed.'))
      .mockResolvedValueOnce();

    await act(async () => result.current.toggle());
    expect(result.current).toMatchObject({
      isOpen: false,
      pending: false,
      error: 'Opening failed.',
    });
    await act(async () => result.current.toggle());
    expect(dependencies.openSidePanel).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ isOpen: true, error: null });
  });

  test('uses a generic recoverable message for non-Error rejection', async () => {
    const { result, dependencies } = setup();
    dependencies.openSidePanel.mockRejectedValueOnce('failed');

    await act(async () => result.current.toggle());

    expect(result.current.error).toBe(
      'Unable to update the Side Panel. Try again.',
    );
  });

  test('keeps a newer lifecycle event and operation authoritative over stale completion', async () => {
    const opening = deferred();
    const closing = deferred();
    const { result, dependencies, emit } = setup();
    dependencies.openSidePanel.mockReturnValueOnce(opening.promise);
    dependencies.closeSidePanel.mockReturnValueOnce(closing.promise);
    act(() => void result.current.toggle());

    emit(true);
    expect(result.current.pending).toBe(false);
    act(() => void result.current.toggle());
    expect(result.current).toMatchObject({ isOpen: false, pending: true });
    act(() => {
      opening.reject(new Error('Stale failure.'));
    });
    await act(() => Promise.resolve());

    expect(result.current).toMatchObject({
      isOpen: false,
      pending: true,
      error: null,
    });
    act(() => {
      closing.resolve();
    });
    await act(() => Promise.resolve());
    expect(result.current.pending).toBe(false);
  });

  test('synchronizes external lifecycle events and clears stale errors', async () => {
    const { result, dependencies, emit } = setup();
    dependencies.openSidePanel.mockRejectedValueOnce(new Error('Failed.'));
    await act(async () => result.current.toggle());
    expect(result.current.error).toBe('Failed.');
    emit(true);
    expect(result.current).toMatchObject({ isOpen: true, error: null });
    emit(false);
    expect(result.current.isOpen).toBe(false);
  });

  test('unsubscribes and ignores a late Promise after unmount', async () => {
    const pending = deferred();
    const { result, dependencies, unsubscribe, unmount } = setup();
    dependencies.openSidePanel.mockReturnValueOnce(pending.promise);
    act(() => void result.current.toggle());
    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
    act(() => {
      pending.reject(new Error('Late failure.'));
    });
    await act(() => Promise.resolve());
  });
});
