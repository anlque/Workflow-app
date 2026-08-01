import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession, pauseSession, stopSession } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { didCrossPhaseBoundary } from './didCrossPhaseBoundary';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    { type: 'focus', durationSeconds: 1, environment: {} },
    { type: 'break', durationSeconds: 1, environment: {} },
    { type: 'focus', durationSeconds: 1, environment: {} },
  ],
});

describe('didCrossPhaseBoundary', () => {
  test('detects one observed Phase transition', () => {
    const initial = createSession('session-1', workflow, 1_000);

    expect(
      didCrossPhaseBoundary(initial, deriveSessionState(initial, 2_000)),
    ).toBe(true);
  });

  test('collapses skipped Phase transitions into one boundary event', () => {
    const initial = createSession('session-1', workflow, 1_000);

    expect(
      didCrossPhaseBoundary(initial, deriveSessionState(initial, 3_000)),
    ).toBe(true);
  });

  test('treats Session completion as the final Phase boundary', () => {
    const initial = createSession('session-1', workflow, 1_000);

    expect(
      didCrossPhaseBoundary(initial, deriveSessionState(initial, 4_000)),
    ).toBe(true);
  });

  test('ignores duplicate projections and same-Phase pause or stop transitions', () => {
    const initial = createSession('session-1', workflow, 1_000);

    expect(didCrossPhaseBoundary(initial, initial)).toBe(false);
    expect(didCrossPhaseBoundary(initial, pauseSession(initial, 1_500))).toBe(
      false,
    );
    expect(didCrossPhaseBoundary(initial, stopSession(initial, 1_500))).toBe(
      false,
    );
  });

  test('ignores projections from another Session', () => {
    const initial = createSession('session-1', workflow, 1_000);
    const another = deriveSessionState(
      createSession('session-2', workflow, 1_000),
      2_000,
    );

    expect(didCrossPhaseBoundary(initial, another)).toBe(false);
  });
});
