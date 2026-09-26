import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { LocusoraDatabase } from '@/platform/storage';
import { createWorkflow, workflowDatabaseSchemas } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  pauseSession,
  rollSessionReward,
  stopSession,
  type Session,
} from '../domain/Session';
import { SessionValidationError } from '../domain/SessionErrors';
import { deriveSessionState } from '../domain/deriveSessionState';
import { rollSessionRewardUseCase } from '../application/rollSessionRewardUseCase';
import { DexieSessionRepository } from './DexieSessionRepository';
import { sessionDatabaseSchemas, type SessionRecord } from './SessionRecord';

const databaseNames: string[] = [];

function database(
  name = `locusora-session-test-${crypto.randomUUID()}`,
): LocusoraDatabase {
  databaseNames.push(name);
  return new LocusoraDatabase({
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
  test('round-trips canonical version-7 active Bonus state', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const rewarded = createWorkflow({
      id: 'v7-bonus-workflow',
      name: 'V7 Bonus',
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
    const rewardPaused = deriveSessionState(
      createSession('v7-bonus-session', rewarded, 1_000),
      3_000,
    );
    const running = continueRewardSession(
      rollSessionReward(rewardPaused, () => 0, 'roll-v7'),
      4_000,
      'continue-v7',
    );
    await repository.save(running);

    await expect(repository.get(running.id)).resolves.toEqual(running);
    await expect(
      store.table<SessionRecord, string>('sessions').get(running.id),
    ).resolves.toMatchObject({
      schemaVersion: 7,
      session: {
        activeBonusPhase: {
          rewardRitualId: 'v7-bonus-session:0',
          selectedSideIndex: 0,
        },
      },
    });
  });

  test.each([1, 2, 3, 4] as const)(
    'restores a non-final Reward pause from legacy version %s without inventing a result',
    async (schemaVersion) => {
      const store = database();
      const repository = new DexieSessionRepository(store);
      const rewarded = createWorkflow({
        id: `legacy-non-final-${String(schemaVersion)}`,
        name: 'Legacy non-final',
        phases: [
          { type: 'focus', durationSeconds: 1, environment: {} },
          { type: 'break', durationSeconds: 1, environment: {} },
        ],
        rewardDice: {
          frequency: 1,
          sides: [
            { icon: 'a', title: 'A' },
            { icon: 'b', title: 'B' },
          ],
        },
      });
      const paused = deriveSessionState(
        createSession(
          `legacy-non-final-${String(schemaVersion)}`,
          rewarded,
          1_000,
        ),
        3_000,
      );
      await repository.save(paused);
      const table = store.table<SessionRecord, string>('sessions');
      const stored = structuredClone(await table.get(paused.id)) as unknown as {
        schemaVersion: 1 | 2 | 3 | 4 | 5;
        session: Record<string, unknown> & {
          workflow: { rewardDice: Record<string, unknown> };
        };
      };
      stored.schemaVersion = schemaVersion;
      delete stored.session['rewardRitual'];
      delete stored.session['rewardCommandReceipts'];
      const reward = stored.session.workflow.rewardDice;
      delete reward['rerolls'];
      if (schemaVersion < 3) {
        const schedule = reward['schedule'] as Record<string, unknown>;
        reward['triggerPhaseType'] = schedule['triggerPhaseType'];
        reward['frequency'] = schedule['frequency'];
        delete reward['schedule'];
      }
      if (schemaVersion < 4) {
        for (const side of reward['sides'] as Record<string, unknown>[]) {
          delete side['availability'];
        }
      }
      await table.put(stored as unknown as SessionRecord);

      const restored = await repository.get(paused.id);
      expect(restored?.rewardRitual).toMatchObject({
        completedPhaseIndex: 0,
        rerollsUsed: 0,
        acknowledged: false,
        continuation: { type: 'phase', phaseIndex: 1 },
      });
      expect(restored?.rewardRitual?.selectedSideIndex).toBeUndefined();
    },
  );

  test('rejects a version-6 Reward pause without its authoritative ritual', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const rewarded = createWorkflow({
      id: 'missing-v6-ritual-workflow',
      name: 'Missing v6 ritual',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'a', title: 'A' },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const paused = deriveSessionState(
      createSession('missing-v6-ritual', rewarded, 1_000),
      3_000,
    );
    await repository.save(paused);
    const table = store.table<SessionRecord, string>('sessions');
    const stored = structuredClone(await table.get(paused.id)) as unknown as {
      schemaVersion: number;
      session: Record<string, unknown>;
    };
    stored.schemaVersion = 6;
    delete stored.session['rewardRitual'];
    delete stored.session['activeBonusPhase'];
    await table.put(stored as unknown as SessionRecord);

    await expect(repository.get(paused.id)).rejects.toBeInstanceOf(
      SessionValidationError,
    );
  });

  test.each([1, 2, 3, 4] as const)(
    'restores a final Reward pause from legacy version %s without inventing a result',
    async (schemaVersion) => {
      const store = database();
      const repository = new DexieSessionRepository(store);
      const rewarded = createWorkflow({
        id: `legacy-final-${String(schemaVersion)}`,
        name: 'Legacy final',
        phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
        rewardDice: {
          frequency: 1,
          sides: [
            { icon: 'a', title: 'A' },
            { icon: 'b', title: 'B' },
          ],
        },
      });
      const paused = deriveSessionState(
        createSession(`legacy-final-${String(schemaVersion)}`, rewarded, 1_000),
        3_000,
      );
      await repository.save(paused);
      const table = store.table<SessionRecord, string>('sessions');
      const stored = structuredClone(await table.get(paused.id)) as unknown as {
        schemaVersion: 1 | 2 | 3 | 4 | 5;
        session: Record<string, unknown> & {
          workflow: { rewardDice: Record<string, unknown> };
        };
      };
      stored.schemaVersion = schemaVersion;
      delete stored.session['rewardRitual'];
      delete stored.session['rewardCommandReceipts'];
      const reward = stored.session.workflow.rewardDice;
      delete reward['rerolls'];
      if (schemaVersion < 3) {
        const schedule = reward['schedule'] as Record<string, unknown>;
        reward['triggerPhaseType'] = schedule['triggerPhaseType'];
        reward['frequency'] = schedule['frequency'];
        delete reward['schedule'];
      }
      if (schemaVersion < 4) {
        for (const side of reward['sides'] as Record<string, unknown>[]) {
          delete side['availability'];
        }
      }
      await table.put(stored as unknown as SessionRecord);

      const restored = await repository.get(paused.id);
      expect(restored?.rewardRitual).toMatchObject({
        completedPhaseIndex: 0,
        rerollsUsed: 0,
        acknowledged: false,
        continuation: { type: 'complete' },
      });
      expect(restored?.rewardRitual?.selectedSideIndex).toBeUndefined();
    },
  );

  test('deduplicates reroll A after reroll B and repository restart', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const rewarded = createWorkflow({
      id: 'reward-retry',
      name: 'Reward retry',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        rerolls: 3,
        sides: [
          { icon: 'a', title: 'A' },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const paused = deriveSessionState(
      createSession('retry-session', rewarded, 1_000),
      3_000,
    );
    await repository.save(paused);
    await rollSessionRewardUseCase(
      repository,
      paused.id,
      () => 0,
      false,
      'roll-1',
      'retry-session:0',
    );
    await rollSessionRewardUseCase(
      repository,
      paused.id,
      () => 0.25,
      true,
      'reroll-a',
      'retry-session:0',
    );
    const afterB = await rollSessionRewardUseCase(
      repository,
      paused.id,
      () => 0.75,
      true,
      'reroll-b',
      'retry-session:0',
    );

    const restarted = new DexieSessionRepository(store);
    const save = vi.spyOn(restarted, 'save');
    const random = vi.fn(() => 0.5);
    const retried = await rollSessionRewardUseCase(
      restarted,
      paused.id,
      random,
      true,
      'reroll-a',
      'retry-session:0',
    );

    expect(retried).toEqual(afterB);
    expect(retried.rewardRitual?.rerollsUsed).toBe(2);
    expect(random).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test('round-trips authoritative Reward ritual and Bonus configuration in v7', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const rewarded = createWorkflow({
      id: 'reward-v5',
      name: 'Reward v5',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        rerolls: 1,
        sides: [
          {
            icon: 'a',
            title: 'A',
            bonusPhase: {
              name: 'Bonus',
              durationSeconds: 300,
              environment: {
                audioAsset: { type: 'direct', assetId: 'audio-1' },
              },
            },
          },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const paused = deriveSessionState(
      createSession('reward-session', rewarded, 1_000),
      3_000,
    );
    const rolled = rollSessionReward(paused, () => 0.99, 'roll-1');
    await repository.save(rolled);

    await expect(repository.get(rolled.id)).resolves.toEqual(rolled);
    await expect(
      store.table<SessionRecord, string>('sessions').get(rolled.id),
    ).resolves.toMatchObject({
      schemaVersion: 7,
      session: {
        rewardRitual: {
          id: 'reward-session:0',
          selectedSideIndex: 1,
          rerollsUsed: 0,
        },
        rewardCommandReceipts: [
          {
            commandId: 'roll-1',
            type: 'roll',
            rewardRitualId: 'reward-session:0',
          },
        ],
      },
    });
    const validRecord = await store
      .table<SessionRecord, string>('sessions')
      .get(rolled.id);
    const corrupt = structuredClone(validRecord) as {
      session: { rewardRitual: { selectedSideIndex: number } };
    };
    corrupt.session.rewardRitual.selectedSideIndex = 99;
    await store
      .table<SessionRecord, string>('sessions')
      .put(corrupt as unknown as SessionRecord);
    await expect(repository.get(rolled.id)).rejects.toThrow(
      'Session Reward ritual is invalid.',
    );

    const invalidReceipt = structuredClone(validRecord) as {
      session: { rewardCommandReceipts: { type: string }[] };
    };
    const receipt = invalidReceipt.session.rewardCommandReceipts[0];
    if (receipt === undefined) throw new Error('Expected Reward receipt.');
    receipt.type = 'unknown';
    await store
      .table<SessionRecord, string>('sessions')
      .put(invalidReceipt as unknown as SessionRecord);
    await expect(repository.get(rolled.id)).rejects.toThrow(
      'Stored Session record is invalid.',
    );
  });
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
    const name = `locusora-session-reopen-${crypto.randomUUID()}`;
    const firstDatabase = database(name);
    const expected = createSession('session-1', workflow(), 1_000);
    await new DexieSessionRepository(firstDatabase).save(expected);
    firstDatabase.close();

    const reopenedRepository = new DexieSessionRepository(database(name));

    await expect(reopenedRepository.getActive()).resolves.toEqual(expected);
  });

  test.each([
    ['v1 legacy IDs', 1, { backgroundAssetId: 'image-1' }, true],
    [
      'v2 direct reference',
      2,
      { backgroundAsset: { type: 'direct', assetId: 'image-1' } },
      true,
    ],
    [
      'v3 direct reference',
      3,
      { backgroundAsset: { type: 'direct', assetId: 'image-1' } },
      true,
    ],
    [
      'v1 with v2 reference',
      1,
      { backgroundAsset: { type: 'direct', assetId: 'image-1' } },
      false,
    ],
    ['v2 with legacy IDs', 2, { backgroundAssetId: 'image-1' }, false],
    [
      'v2 with Role reference',
      2,
      { backgroundAsset: { type: 'role', role: 'Backdrop' } },
      false,
    ],
  ])(
    'enforces Session snapshot boundary for %s',
    async (_case, schemaVersion, environment, valid) => {
      const store = database();
      const repository = new DexieSessionRepository(store);
      const session = createSession('session-versioned', workflow(), 1_000);
      const table = store.table<SessionRecord, string>('sessions');
      await repository.save(session);
      const stored = await table.get(session.id);
      if (stored === undefined) throw new Error('Expected Session record.');
      const mutable = structuredClone(stored) as unknown as {
        schemaVersion: 1 | 2 | 3;
        session: { workflow: { phases: { environment: unknown }[] } };
      };
      mutable.schemaVersion = schemaVersion as 1 | 2 | 3;
      const firstPhase = mutable.session.workflow.phases[0];
      if (firstPhase === undefined) throw new Error('Expected first Phase.');
      firstPhase.environment = environment;
      await table.put(mutable as unknown as SessionRecord);

      const result = repository.get(session.id);
      if (valid) {
        const restored = await result;
        expect(
          restored?.snapshot.workflow.phases[0]?.environment.backgroundAsset,
        ).toEqual({
          type: 'direct',
          assetId: 'image-1',
        });
      } else {
        await expect(result).rejects.toBeInstanceOf(SessionValidationError);
      }
    },
  );

  test('round-trips a canonical custom Reward schedule in the snapshot', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const customWorkflow = createWorkflow({
      id: 'custom-reward-workflow',
      name: 'Custom reward',
      phases: [
        { type: 'focus', durationSeconds: 10, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
      ],
      rewardDice: {
        schedule: { type: 'custom', phaseIndexes: [1] },
        sides: [
          { icon: 'tea', title: 'Tea', availability: 'early' },
          { icon: 'walk', title: 'Walk', availability: 'late' },
        ],
      },
    });
    const expected = createSession(
      'custom-reward-session',
      customWorkflow,
      1_000,
    );

    await repository.save(expected);

    await expect(repository.get(expected.id)).resolves.toEqual(expected);
    await expect(
      store.table<SessionRecord, string>('sessions').get(expected.id),
    ).resolves.toMatchObject({
      schemaVersion: 7,
      session: {
        workflow: {
          rewardDice: {
            sides: [
              expect.objectContaining({ availability: 'early' }),
              expect.objectContaining({ availability: 'late' }),
            ],
          },
        },
      },
    });
  });

  test('rejects a version-5 Reward Dice without rerolls', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const value = createSession(
      'missing-rerolls',
      createWorkflow({
        id: 'missing-rerolls-workflow',
        name: 'Missing rerolls',
        phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
        rewardDice: {
          frequency: 1,
          sides: [
            { icon: 'tea', title: 'Tea' },
            { icon: 'walk', title: 'Walk' },
          ],
        },
      }),
      1_000,
    );
    await repository.save(value);
    const table = store.table<SessionRecord, string>('sessions');
    const stored = structuredClone(await table.get(value.id)) as unknown as {
      session: { workflow: { rewardDice: Record<string, unknown> } };
    };
    delete stored.session.workflow.rewardDice['rerolls'];
    await table.put(stored as unknown as SessionRecord);

    await expect(repository.get(value.id)).rejects.toBeInstanceOf(
      SessionValidationError,
    );
  });

  test('rejects malformed version-4 Side availability', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const value = createSession(
      'invalid-availability',
      createWorkflow({
        id: 'rewarded',
        name: 'Rewarded',
        phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
        rewardDice: {
          frequency: 1,
          sides: [
            { icon: 'tea', title: 'Tea' },
            { icon: 'walk', title: 'Walk' },
          ],
        },
      }),
      1_000,
    );
    await repository.save(value);
    const table = store.table<SessionRecord, string>('sessions');
    const stored = structuredClone(await table.get(value.id)) as unknown as {
      session: {
        workflow: { rewardDice: { sides: Record<string, unknown>[] } };
      };
    };
    const firstSide = stored.session.workflow.rewardDice.sides[0];
    if (firstSide === undefined) throw new Error('Expected first Dice Side.');
    firstSide['availability'] = 'sometimes';
    await table.put(stored as unknown as SessionRecord);

    await expect(repository.get(value.id)).rejects.toBeInstanceOf(
      SessionValidationError,
    );
  });

  test.each([1, 2, 3] as const)(
    'defaults missing Side availability in a real raw version-%s Session record',
    async (schemaVersion) => {
      const store = database();
      const repository = new DexieSessionRepository(store);
      const value = createSession(
        `legacy-side-${String(schemaVersion)}`,
        createWorkflow({
          id: 'rewarded',
          name: 'Rewarded',
          phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
          rewardDice: {
            frequency: 1,
            sides: [
              { icon: 'tea', title: 'Tea' },
              { icon: 'walk', title: 'Walk' },
            ],
          },
        }),
        1_000,
      );
      await repository.save(value);
      const table = store.table<SessionRecord, string>('sessions');
      const stored = structuredClone(await table.get(value.id)) as unknown as {
        schemaVersion: 1 | 2 | 3 | 4;
        session: { workflow: { rewardDice: Record<string, unknown> } };
      };
      stored.schemaVersion = schemaVersion;
      const reward = stored.session.workflow.rewardDice;
      for (const side of reward['sides'] as Record<string, unknown>[]) {
        delete side['availability'];
      }
      if (schemaVersion < 3) {
        const schedule = reward['schedule'] as Record<string, unknown>;
        reward['triggerPhaseType'] = schedule['triggerPhaseType'];
        reward['frequency'] = schedule['frequency'];
        delete reward['schedule'];
      }
      await table.put(stored as unknown as SessionRecord);

      await expect(repository.get(value.id)).resolves.toMatchObject({
        snapshot: {
          workflow: {
            rewardDice: {
              sides: [
                expect.objectContaining({ availability: 'any' }),
                expect.objectContaining({ availability: 'any' }),
              ],
            },
          },
        },
      });
    },
  );

  test('rejects a version-3 snapshot frequency schedule without triggerPhaseType', async () => {
    const store = database();
    const repository = new DexieSessionRepository(store);
    const rewardedWorkflow = createWorkflow({
      id: 'canonical-workflow',
      name: 'Canonical',
      phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const session = createSession('canonical-session', rewardedWorkflow, 1_000);
    await repository.save(session);
    const table = store.table<SessionRecord, string>('sessions');
    const stored = await table.get(session.id);
    if (stored === undefined) throw new Error('Expected Session record.');
    const reward = (
      stored as unknown as {
        session: {
          workflow: { rewardDice: { schedule: Record<string, unknown> } };
        };
      }
    ).session.workflow.rewardDice;
    delete reward.schedule['triggerPhaseType'];
    await table.put(stored);

    await expect(repository.get(session.id)).rejects.toBeInstanceOf(
      SessionValidationError,
    );
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
    (stored as { schemaVersion: 1 | 2 | 3 | 4 }).schemaVersion = 1;
    const schedule = storedReward['schedule'] as {
      triggerPhaseType?: unknown;
      frequency?: unknown;
    };
    storedReward['triggerPhaseType'] = schedule.triggerPhaseType;
    storedReward['frequency'] = schedule.frequency;
    delete storedReward['schedule'];
    delete storedReward['rerolls'];
    for (const side of storedReward['sides'] as Record<string, unknown>[]) {
      delete side['availability'];
    }
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
