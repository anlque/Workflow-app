// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
  continueRewardSession,
  createSession,
  deriveSessionState,
  pauseSession,
  rollSessionReward,
  stopSession,
} from '@/features/session';
import { createWorkflow } from '@/features/workflow';

import { getFocusSpaceShortcutAction } from './getFocusSpaceShortcutAction';

const session = createSession(
  'space-shortcut-session',
  createWorkflow({
    id: 'space-shortcut-workflow',
    name: 'Space shortcut',
    phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
  }),
  1_000,
);

function event(target: Element = document.body, init: KeyboardEventInit = {}) {
  const value = new KeyboardEvent('keydown', {
    code: 'Space',
    cancelable: true,
    ...init,
  });
  Object.defineProperty(value, 'target', { value: target });
  return value;
}

describe('getFocusSpaceShortcutAction', () => {
  test('maps running and user-paused Sessions to authoritative actions', () => {
    const context = {
      enabled: true,
      studioOpen: false,
      dialogOpen: false,
      pending: false,
      session,
    };
    expect(getFocusSpaceShortcutAction(event(), context)).toBe('pause');
    expect(
      getFocusSpaceShortcutAction(event(), {
        ...context,
        session: pauseSession(session, 2_000),
      }),
    ).toBe('resume');
  });

  test.each([
    { enabled: false },
    { studioOpen: true },
    { dialogOpen: true },
    { pending: true },
  ])('ignores guarded UI state %#', (patch) => {
    expect(
      getFocusSpaceShortcutAction(event(), {
        enabled: true,
        studioOpen: false,
        dialogOpen: false,
        pending: false,
        session,
        ...patch,
      }),
    ).toBeNull();
  });

  test('preserves native keyboard behavior for invalid events and interactive targets', () => {
    const context = {
      enabled: true,
      studioOpen: false,
      dialogOpen: false,
      pending: false,
      session,
    };
    expect(
      getFocusSpaceShortcutAction(
        event(document.body, { code: 'Enter' }),
        context,
      ),
    ).toBeNull();
    expect(
      getFocusSpaceShortcutAction(
        event(document.body, { repeat: true }),
        context,
      ),
    ).toBeNull();
    expect(
      getFocusSpaceShortcutAction(
        event(document.body, { ctrlKey: true }),
        context,
      ),
    ).toBeNull();
    for (const modifier of ['altKey', 'metaKey', 'shiftKey'] as const) {
      expect(
        getFocusSpaceShortcutAction(
          event(document.body, { [modifier]: true }),
          context,
        ),
      ).toBeNull();
    }
    const prevented = event();
    prevented.preventDefault();
    expect(getFocusSpaceShortcutAction(prevented, context)).toBeNull();
    const link = document.createElement('a');
    link.href = '#target';
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const editableChild = document.createElement('span');
    editable.append(editableChild);
    for (const element of [
      document.createElement('input'),
      document.createElement('button'),
      document.createElement('textarea'),
      document.createElement('select'),
      link,
      editable,
      editableChild,
    ]) {
      expect(getFocusSpaceShortcutAction(event(element), context)).toBeNull();
    }
  });

  test('ignores absent and terminal Sessions', () => {
    const context = {
      enabled: true,
      studioOpen: false,
      dialogOpen: false,
      pending: false,
      session: null,
    };
    expect(getFocusSpaceShortcutAction(event(), context)).toBeNull();
    expect(
      getFocusSpaceShortcutAction(event(), {
        ...context,
        session: stopSession(session, 2_000),
      }),
    ).toBeNull();
  });

  test('supports running and user-paused Bonus segments but not Reward, transition, or completed states', () => {
    const rewardedWorkflow = createWorkflow({
      id: 'space-shortcut-rewarded-workflow',
      name: 'Space shortcut rewarded',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'a',
            title: 'A',
            bonusPhase: {
              name: 'Bonus',
              durationSeconds: 30,
              environment: {},
            },
          },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const initial = createSession(
      'space-shortcut-rewarded-session',
      rewardedWorkflow,
      1_000,
    );
    const transitioning = deriveSessionState(initial, 2_000);
    const rewardPaused = deriveSessionState(initial, 3_000);
    const bonus = continueRewardSession(
      rollSessionReward(rewardPaused, () => 0),
      4_000,
      'space-shortcut-continue',
    );
    const completed = deriveSessionState(
      createSession(
        'space-shortcut-completed-session',
        createWorkflow({
          id: 'space-shortcut-completed-workflow',
          name: 'Completed',
          phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
        }),
        1_000,
      ),
      3_000,
    );
    const context = {
      enabled: true,
      studioOpen: false,
      dialogOpen: false,
      pending: false,
      session: bonus,
    };

    expect(getFocusSpaceShortcutAction(event(), context)).toBe('pause');
    expect(
      getFocusSpaceShortcutAction(event(), {
        ...context,
        session: pauseSession(bonus, 5_000),
      }),
    ).toBe('resume');
    for (const unavailable of [transitioning, rewardPaused, completed]) {
      expect(
        getFocusSpaceShortcutAction(event(), {
          ...context,
          session: unavailable,
        }),
      ).toBeNull();
    }
  });
});
