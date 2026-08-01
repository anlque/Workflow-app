import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession, pauseSession } from '../domain/Session';
import { formatSessionCountdown } from './sessionCountdown';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [{ type: 'focus', durationSeconds: 125, environment: {} }],
});

describe('formatSessionCountdown', () => {
  test('derives a running countdown from timing anchors', () => {
    expect(
      formatSessionCountdown(
        createSession('session-1', workflow, 1_000),
        6_500,
      ),
    ).toBe('02:00');
  });

  test('uses the frozen remaining duration while paused', () => {
    const paused = pauseSession(
      createSession('session-1', workflow, 1_000),
      31_000,
    );
    expect(formatSessionCountdown(paused, 90_000)).toBe('01:35');
  });
});
