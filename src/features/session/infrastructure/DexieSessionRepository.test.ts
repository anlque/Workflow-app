import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test } from 'vitest';

import { FlowariumDatabase } from '@/platform/storage';
import { createWorkflow, workflowDatabaseSchemas } from '@/features/workflow';

import {
  createSession,
  pauseSession,
  stopSession,
  type Session,
} from '../domain/Session';
import { SessionValidationError } from '../domain/SessionErrors';
import { deriveSessionState } from '../domain/deriveSessionState';
import { DexieSessionRepository } from './DexieSessionRepository';
import { sessionDatabaseSchemas } from './SessionRecord';

const databaseNames: string[] = [];

function database(
  name = `flowarium-session-test-${crypto.randomUUID()}`,
): FlowariumDatabase {
  databaseNames.push(name);
  return new FlowariumDatabase({
    name,
    schemas: [...workflowDatabaseSchemas, ...sessionDatabaseSchemas],
  });
}

function workflow() {
  return createWorkflow({
    id: 'workflow-1',
    name: 'Deep work',
    phases: [
      { type: 'focus', durationSeconds: 10, environment: {} },
      { type: 'break', durationSeconds: 5, environment: {} },
    ],
  });
}

afterEach(async () => {
  await Promise.all(
    [...new Set(databaseNames.splice(0))].map((name) => Dexie.delete(name)),
  );
});

describe('DexieSessionRepository', () => {
  test.each([
    ['running', () => createSession('running', workflow(), 1_000)],
    [
      'paused',
      () => pauseSession(createSession('paused', workflow(), 1_000), 3_000),
    ],
    [
      'completed',
      () =>
        deriveSessionState(
          createSession('completed', workflow(), 1_000),
          30_000,
        ),
    ],
    [
      'stopped',
      () => stopSession(createSession('stopped', workflow(), 1_000), 3_000),
    ],
  ] satisfies readonly [string, () => Session][])(
    'round-trips a %s Session',
    async (_name, makeSession) => {
      const repository = new DexieSessionRepository(database());
      const expected = makeSession();

      await repository.save(expected);

      await expect(repository.get(expected.id)).resolves.toEqual(expected);
    },
  );

  test('restores the active Session after reopening the database', async () => {
    const name = `flowarium-session-reopen-${crypto.randomUUID()}`;
    const firstDatabase = database(name);
    const expected = createSession('session-1', workflow(), 1_000);
    await new DexieSessionRepository(firstDatabase).save(expected);
    firstDatabase.close();

    const reopenedRepository = new DexieSessionRepository(database(name));

    await expect(reopenedRepository.getActive()).resolves.toEqual(expected);
  });

  test('rejects saving a second active Session transactionally', async () => {
    const repository = new DexieSessionRepository(database());
    const first = createSession('session-1', workflow(), 1_000);
    const second = createSession('session-2', workflow(), 2_000);
    await repository.save(first);

    await expect(repository.save(second)).rejects.toThrow(
      'An active Session already exists.',
    );
    await expect(repository.get(second.id)).resolves.toBeNull();
    await expect(repository.getActive()).resolves.toEqual(first);
  });

  test('clears active lookup when a Session becomes terminal', async () => {
    const repository = new DexieSessionRepository(database());
    const running = createSession('session-1', workflow(), 1_000);
    await repository.save(running);

    await repository.save(stopSession(running, 2_000));

    await expect(repository.getActive()).resolves.toBeNull();
  });

  test('rejects corrupted Session data at the persistence boundary', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    await store.table('sessions').put({
      id: 'corrupted',
      schemaVersion: 1,
      active: 1,
      status: 'running',
    });

    await expect(repository.getActive()).rejects.toBeInstanceOf(
      SessionValidationError,
    );
  });
});
