import { describe, expect, test } from 'vitest';

import {
  RuntimeMessageValidationError,
  parseActiveSessionRequest,
  parseSessionCommand,
  parseWorkflowCatalogChangedMessage,
} from './runtimeMessageSchema';

describe('parseWorkflowCatalogChangedMessage', () => {
  test('accepts the exact Workflow catalog invalidation event', () => {
    expect(
      parseWorkflowCatalogChangedMessage({
        type: 'workflow/catalog-changed',
      }),
    ).toEqual({ type: 'workflow/catalog-changed' });
  });

  test.each([
    null,
    [],
    {},
    { type: 'workflow/catalog-changed', extra: true },
    { type: 'workflow/catalog-change' },
  ])('rejects an invalid Workflow catalog event %#', (value) => {
    expect(() => parseWorkflowCatalogChangedMessage(value)).toThrow(
      RuntimeMessageValidationError,
    );
  });
});

describe('parseActiveSessionRequest', () => {
  test('accepts an exact active Session request', () => {
    expect(
      parseActiveSessionRequest({
        type: 'session/get-active',
        requestId: 'request-1',
      }),
    ).toEqual({ type: 'session/get-active', requestId: 'request-1' });
  });

  test.each([
    null,
    { type: 'session/get-active', requestId: '' },
    { type: 'session/get-active', requestId: 'request-1', extra: true },
  ])('rejects an invalid active Session request %#', (value) => {
    expect(() => parseActiveSessionRequest(value)).toThrow(
      RuntimeMessageValidationError,
    );
  });
});

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
    [
      {
        type: 'session/continue-reward',
        commandId: 'command-5',
        sessionId: 'session-1',
      },
      'session/continue-reward',
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
