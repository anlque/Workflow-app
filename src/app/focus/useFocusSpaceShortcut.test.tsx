import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { createSession, pauseSession, type Session } from '@/features/session';
import { createWorkflow } from '@/features/workflow';

import { useFocusSpaceShortcut } from './useFocusSpaceShortcut';

const workflow = createWorkflow({
  id: 'space-hook-workflow',
  name: 'Space hook',
  phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
});
const session = createSession('space-hook-session', workflow, 1_000);

describe('useFocusSpaceShortcut', () => {
  test('prevents default, stays single-flight and follows live Session state', async () => {
    let finish: (() => void) | undefined;
    const pause = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const resume = vi.fn(() => Promise.resolve());
    const activateSounds = vi.fn(() => Promise.resolve());
    const { rerender } = renderHook(
      ({ current }) =>
        useFocusSpaceShortcut({
          session: current,
          enabled: true,
          studioOpen: false,
          activateSounds,
          pause,
          resume,
        }),
      { initialProps: { current: session as Session } },
    );
    const first = new KeyboardEvent('keydown', {
      code: 'Space',
      cancelable: true,
    });
    act(() => {
      document.dispatchEvent(first);
    });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space', cancelable: true }),
      );
    });
    expect(first.defaultPrevented).toBe(true);
    expect(pause).toHaveBeenCalledOnce();
    expect(activateSounds).toHaveBeenCalledOnce();

    await act(() => {
      finish?.();
      return Promise.resolve();
    });
    rerender({ current: pauseSession(session, 2_000) });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space', cancelable: true }),
      );
    });
    expect(resume).toHaveBeenCalledWith(session.id);
  });

  test('reports a failure and permits retry', async () => {
    const pause = vi
      .fn(() => Promise.resolve())
      .mockRejectedValueOnce(new Error('Pause unavailable.'));
    const { result } = renderHook(() =>
      useFocusSpaceShortcut({
        session,
        enabled: true,
        studioOpen: false,
        activateSounds: () => Promise.resolve(),
        pause,
        resume: () => Promise.resolve(),
      }),
    );
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      await Promise.resolve();
    });
    expect(result.current).toBe('Pause unavailable.');
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      await Promise.resolve();
    });
    expect(pause).toHaveBeenCalledTimes(2);
    expect(result.current).toBeNull();
  });

  test('ignores a stale rejection and keeps the new Session command pending', async () => {
    let rejectOld: ((cause: Error) => void) | undefined;
    let resolveCurrent: (() => void) | undefined;
    const pause = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectOld = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveCurrent = resolve;
          }),
      );
    const nextSession = createSession(
      'space-hook-session-next',
      workflow,
      3_000,
    );
    const { result, rerender } = renderHook(
      ({ current }) =>
        useFocusSpaceShortcut({
          session: current,
          enabled: true,
          studioOpen: false,
          activateSounds: () => Promise.resolve(),
          pause,
          resume: () => Promise.resolve(),
        }),
      { initialProps: { current: session as Session } },
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    rerender({ current: nextSession });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    expect(pause).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenLastCalledWith(nextSession.id);
    await act(async () => {
      rejectOld?.(new Error('Old Session failed.'));
      await Promise.resolve();
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });

    expect(result.current).toBeNull();
    expect(pause).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveCurrent?.();
      await Promise.resolve();
    });
  });

  test('follows live enablement and Studio state while preserving native repeat and dialog behavior', () => {
    const pause = vi.fn(() => Promise.resolve());
    const { rerender } = renderHook(
      ({ enabled, studioOpen }) =>
        useFocusSpaceShortcut({
          session,
          enabled,
          studioOpen,
          activateSounds: () => Promise.resolve(),
          pause,
          resume: () => Promise.resolve(),
        }),
      { initialProps: { enabled: false, studioOpen: false } },
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space', repeat: true }),
      );
    });
    rerender({ enabled: true, studioOpen: true });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    rerender({ enabled: true, studioOpen: false });
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    dialog.remove();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });

    expect(pause).toHaveBeenCalledOnce();
  });

  test('removes the keyboard listener on unmount', () => {
    const pause = vi.fn(() => Promise.resolve());
    const { unmount } = renderHook(() =>
      useFocusSpaceShortcut({
        session,
        enabled: true,
        studioOpen: false,
        activateSounds: () => Promise.resolve(),
        pause,
        resume: () => Promise.resolve(),
      }),
    );
    unmount();

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

    expect(pause).not.toHaveBeenCalled();
  });
});
