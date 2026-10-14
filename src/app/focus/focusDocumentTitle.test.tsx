import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  continueRewardSession,
  createSession,
  deriveSessionState,
  pauseSession,
  rollSessionReward,
} from '@/features/session';
import { createWorkflow } from '@/features/workflow';

import { formatFocusDocumentTitle } from './focusDocumentTitle';
import { useFocusDocumentTitle } from './useFocusDocumentTitle';

const workflow = createWorkflow({
  id: 'title-workflow',
  name: 'Title workflow',
  phases: [
    { type: 'focus', durationSeconds: 10, environment: {} },
    { type: 'break', durationSeconds: 5, environment: {} },
  ],
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatFocusDocumentTitle', () => {
  test('formats running, paused and transitioning Session projections', () => {
    const running = createSession('title-session', workflow, 1_000);
    const paused = pauseSession(running, 2_000);
    const transitioning = deriveSessionState(running, 11_000);

    expect(formatFocusDocumentTitle(running, 1_000)).toBe(
      '00:10 · Focus · Phase 1 of 2 · Locusora',
    );
    expect(formatFocusDocumentTitle(paused, 9_000)).toBe(
      '00:09 · Focus · Phase 1 of 2 · Locusora',
    );
    expect(formatFocusDocumentTitle(transitioning, 11_000)).toBe(
      '00:00 · Transition · Locusora',
    );
  });

  test('formats Reward and Bonus projections and stabilizes idle or terminal title', () => {
    const rewarded = createWorkflow({
      id: 'reward-title-workflow',
      name: 'Reward title workflow',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'a',
            title: 'A',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 30,
              environment: {},
            },
          },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const reward = deriveSessionState(
      createSession('reward-title-session', rewarded, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(reward, () => 0, 'title-roll'),
      4_000,
      'title-continue',
    );
    const terminal = deriveSessionState(
      createSession(
        'terminal-title-session',
        createWorkflow({
          id: 'terminal-title-workflow',
          name: 'Terminal title workflow',
          phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
        }),
        1_000,
      ),
      3_000,
    );

    expect(formatFocusDocumentTitle(reward, 3_000)).toBe(
      '00:05 · Break · Phase 2 of 2 · Locusora',
    );
    expect(formatFocusDocumentTitle(bonus, 4_000)).toBe(
      '00:30 · Bonus · Tea break · Locusora',
    );
    expect(formatFocusDocumentTitle(null, 4_000)).toBe('Locusora focus');
    expect(formatFocusDocumentTitle(terminal, 4_000)).toBe('Locusora focus');
  });
});

describe('useFocusDocumentTitle', () => {
  test('writes only changed title text and cleans up its ticking interval', () => {
    vi.useFakeTimers();
    const session = createSession('title-hook-session', workflow, 1_000);
    let now = 1_000;
    let title = 'Initial';
    let writes = 0;
    const target = {
      get title() {
        return title;
      },
      set title(value: string) {
        title = value;
        writes += 1;
      },
    };
    const { unmount } = renderHook(() => {
      useFocusDocumentTitle(session, () => now, target);
    });

    expect(title).toBe('00:10 · Focus · Phase 1 of 2 · Locusora');
    expect(writes).toBe(1);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(writes).toBe(1);

    now = 2_000;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(title).toBe('00:09 · Focus · Phase 1 of 2 · Locusora');
    expect(writes).toBe(2);

    unmount();
    now = 3_000;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(writes).toBe(2);
  });
});
