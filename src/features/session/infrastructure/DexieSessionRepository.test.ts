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
import { sessionDatabaseSchemas, type SessionRecord } from './SessionRecord';

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
      'transitioning',
      () =>
        deriveSessionState(
          createSession('transitioning', workflow(), 1_000),
          11_000,
        ),
    ],
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

  test('keeps a transitioning Session active and blocks a second start', async () => {
    const repository = new DexieSessionRepository(database());
    const transitioning = deriveSessionState(
      createSession('session-1', workflow(), 1_000),
      11_000,
    );
    await repository.save(transitioning);

    await expect(repository.getActive()).resolves.toEqual(transitioning);
    await expect(
      repository.save(createSession('session-2', workflow(), 12_000)),
    ).rejects.toThrow('An active Session already exists.');
  });

  test('maps a legacy paused record without a pause reason to a user pause', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const paused = pauseSession(
      createSession('session-1', workflow(), 1_000),
      3_000,
    );
    await repository.save(paused);
    const table = store.table<SessionRecord, string>('sessions');
    const stored = await table.get(paused.id);
    if (stored === undefined || typeof stored !== 'object') {
      throw new Error('Expected a stored Session record.');
    }
    const storedSession = (stored as { session: Record<string, unknown> })
      .session;
    delete storedSession['pauseReason'];
    await table.put(stored);

    await expect(repository.get(paused.id)).resolves.toMatchObject({
      status: 'paused',
      pauseReason: 'user',
    });
  });

  test('defaults missing version-1 Session Reward Dice rerolls during restoration', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const rewardedWorkflow = createWorkflow({
      id: 'legacy-reward-workflow',
      name: 'Legacy Reward',
      phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      rewardDice: {
        frequency: 1,
        rerolls: 3,
        sides: [
          { icon: '☕', title: 'Tea' },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const session = createSession(
      'legacy-reward-session',
      rewardedWorkflow,
      1_000,
    );
    await repository.save(session);
    const table = store.table<SessionRecord, string>('sessions');
    const stored = await table.get(session.id);
    if (stored === undefined || typeof stored !== 'object') {
      throw new Error('Expected a stored Session record.');
    }
    const storedReward = (
      stored as {
        session: { workflow: { rewardDice?: Record<string, unknown> } };
      }
    ).session.workflow.rewardDice;
    if (storedReward === undefined) {
      throw new Error('Expected stored Reward Dice.');
    }
    delete storedReward['rerolls'];
    await table.put(stored);

    const restored = await repository.get(session.id);

    expect(restored?.snapshot.workflow.rewardDice?.rerolls).toBe(0);
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
