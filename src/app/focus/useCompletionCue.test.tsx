import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createSession,
  deriveSessionState,
  type Session,
} from '@/features/session';
import { createWorkflow } from '@/features/workflow';

import { useCompletionCue } from './useCompletionCue';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
});

const rewardedWorkflow = createWorkflow({
  id: 'rewarded-workflow',
  name: 'Rewarded work',
  phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
  rewardDice: {
    frequency: 1,
    sides: [
      { icon: '☕', title: 'Tea' },
      { icon: '🌿', title: 'Fresh air' },
    ],
  },
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCompletionCue', () => {
  test('plays one classified cue after one second', () => {
    vi.useFakeTimers();
    const initial = createSession('session-1', workflow, 1_000);
    const completed = deriveSessionState(initial, 3_000);
    const sounds = {
      playSessionComplete: vi.fn(),
      playRewardUnlocked: vi.fn(),
    };
    const { rerender } = renderHook(
      ({ session }: Readonly<{ session: Session }>) => {
        useCompletionCue(session, sounds);
      },
      { initialProps: { session: initial as Session } },
    );

    rerender({ session: completed });
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(sounds.playSessionComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sounds.playSessionComplete).toHaveBeenCalledOnce();
    expect(sounds.playRewardUnlocked).not.toHaveBeenCalled();

    rerender({ session: completed });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(sounds.playSessionComplete).toHaveBeenCalledOnce();
  });

  test('cancels a pending cue on unmount', () => {
    vi.useFakeTimers();
    const initial = createSession('session-1', workflow, 1_000);
    const completed = deriveSessionState(initial, 3_000);
    const sounds = {
      playSessionComplete: vi.fn(),
      playRewardUnlocked: vi.fn(),
    };
    const { rerender, unmount } = renderHook(
      ({ session }: Readonly<{ session: Session }>) => {
        useCompletionCue(session, sounds);
      },
      { initialProps: { session: initial as Session } },
    );

    rerender({ session: completed });
    unmount();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(sounds.playSessionComplete).not.toHaveBeenCalled();
  });

  test('delays final completion until the Reward dialog is continued', () => {
    vi.useFakeTimers();
    const initial = createSession('session-1', rewardedWorkflow, 1_000);
    const completed = deriveSessionState(initial, 3_000);
    const sounds = {
      playSessionComplete: vi.fn(),
      playRewardUnlocked: vi.fn(),
    };
    const { result, rerender } = renderHook(
      ({ session }: Readonly<{ session: Session }>) =>
        useCompletionCue(session, sounds),
      { initialProps: { session: initial as Session } },
    );

    rerender({ session: completed });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(sounds.playRewardUnlocked).toHaveBeenCalledOnce();
    expect(sounds.playSessionComplete).not.toHaveBeenCalled();

    act(() => {
      result.current();
      vi.advanceTimersByTime(999);
    });
    expect(sounds.playSessionComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sounds.playSessionComplete).toHaveBeenCalledOnce();
  });
});
