import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession } from '../domain/Session';
import { parseSessionProjection } from './parseSessionProjection';

describe('parseSessionProjection', () => {
  test('restores a transport-safe Session projection', () => {
    const value = createSession(
      'session-1',
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
      }),
      1_000,
    );
    expect(parseSessionProjection(structuredClone(value))).toEqual(value);
  });

  test('accepts null and rejects malformed values', () => {
    expect(parseSessionProjection(null)).toBeNull();
    expect(() => parseSessionProjection({ status: 'running' })).toThrow();
  });
});
