import { describe, expect, test } from 'vitest';

import {
  RuntimeMessageValidationError,
  parseSessionCommand,
} from './runtimeMessageSchema';

describe('parseSessionCommand', () => {
  test.each([
    [
      {
        type: 'session/start',
        commandId: 'command-1',
        workflowId: 'workflow-1',
      },
      'session/start',
    ],
    [
      { type: 'session/pause', commandId: 'command-2', sessionId: 'session-1' },
      'session/pause',
    ],
    [
      {
        type: 'session/resume',
        commandId: 'command-3',
        sessionId: 'session-1',
      },
      'session/resume',
    ],
    [
      { type: 'session/stop', commandId: 'command-4', sessionId: 'session-1' },
      'session/stop',
    ],
  ] as const)('accepts a valid %s command', (value, expectedType) => {
    expect(parseSessionCommand(value).type).toBe(expectedType);
  });

  test.each([
    null,
    [],
    { type: 'unknown', commandId: 'command-1', sessionId: 'session-1' },
    { type: 'session/start', commandId: '', workflowId: 'workflow-1' },
    { type: 'session/start', commandId: 'command-1', workflowId: ' ' },
    { type: 'session/pause', commandId: 'command-1', sessionId: '' },
    {
      type: 'session/stop',
      commandId: 'command-1',
      sessionId: 'session-1',
      unexpected: true,
    },
  ])('rejects untrusted value %#', (value) => {
    expect(() => parseSessionCommand(value)).toThrow(
      RuntimeMessageValidationError,
    );
  });
});
