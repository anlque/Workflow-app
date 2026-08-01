import type {
  ActiveSessionRequest,
  SessionCommand,
  WorkflowCatalogChangedMessage,
} from './RuntimeMessage';

export class RuntimeMessageValidationError extends Error {
  public constructor() {
    super('Runtime message is invalid.');
    this.name = 'RuntimeMessageValidationError';
  }
}

function messageRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RuntimeMessageValidationError();
  }
  return value as Readonly<Record<string, unknown>>;
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeMessageValidationError();
  }
  return value;
}

function hasExactKeys(
  record: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...keys].sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
}

export function parseSessionCommand(value: unknown): SessionCommand {
  const record = messageRecord(value);
  const type = record['type'];
  const commandId = nonEmptyString(record['commandId']);

  if (
    type === 'session/start' &&
    hasExactKeys(record, ['type', 'commandId', 'workflowId'])
  ) {
    return Object.freeze({
      type,
      commandId,
      workflowId: nonEmptyString(record['workflowId']),
    });
  }

  if (
    (type === 'session/pause' ||
      type === 'session/resume' ||
      type === 'session/continue-reward' ||
      type === 'session/stop') &&
    hasExactKeys(record, ['type', 'commandId', 'sessionId'])
  ) {
    return Object.freeze({
      type,
      commandId,
      sessionId: nonEmptyString(record['sessionId']),
    });
  }

  throw new RuntimeMessageValidationError();
}

export function parseActiveSessionRequest(
  value: unknown,
): ActiveSessionRequest {
  const record = messageRecord(value);
  if (
    record['type'] !== 'session/get-active' ||
    !hasExactKeys(record, ['type', 'requestId'])
  ) {
    throw new RuntimeMessageValidationError();
  }
  return Object.freeze({
    type: 'session/get-active',
    requestId: nonEmptyString(record['requestId']),
  });
}

export function parseWorkflowCatalogChangedMessage(
  value: unknown,
): WorkflowCatalogChangedMessage {
  const record = messageRecord(value);
  if (
    record['type'] !== 'workflow/catalog-changed' ||
    !hasExactKeys(record, ['type'])
  ) {
    throw new RuntimeMessageValidationError();
  }
  return Object.freeze({ type: 'workflow/catalog-changed' });
}
