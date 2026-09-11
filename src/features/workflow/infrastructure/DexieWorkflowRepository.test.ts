import 'fake-indexeddb/auto';

import { afterEach, describe, expect, test } from 'vitest';

import { LocusoraDatabase } from '@/platform/storage';

import { createWorkflow } from '../domain/createWorkflow';
import type { Workflow, WorkflowId } from '../domain/Workflow';
import { WorkflowValidationError } from '../domain/WorkflowErrors';
import { DexieWorkflowRepository } from './DexieWorkflowRepository';
import { workflowDatabaseSchemas } from './WorkflowRecord';

const databases: LocusoraDatabase[] = [];

function createDatabase(): LocusoraDatabase {
  const database = new LocusoraDatabase({
    name: `locusora-workflow-test-${crypto.randomUUID()}`,
    schemas: workflowDatabaseSchemas,
  });
  databases.push(database);
  return database;
}

function workflow(id: string, name: string): Workflow {
  return createWorkflow({
    id,
    name,
    phases: [
      {
        type: 'focus',
        durationSeconds: 1_500,
        environment: {
          backgroundAssetId: 'background-1',
          audioAssetId: 'audio-1',
          backgroundColor: '#102030',
        },
      },
      {
        type: 'break',
        durationSeconds: 300,
        environment: {},
      },
    ],
    rewardDice: {
      triggerPhaseType: 'break',
      frequency: 2,
      rerolls: 3,
      sides: [
        { icon: 'tea', title: 'Tea', description: 'Make tea', weight: 3 },
        { icon: 'walk', title: 'Walk', weight: 1 },
      ],
    },
  });
}

async function putWorkflowRecord(
  database: LocusoraDatabase,
  value: unknown,
): Promise<void> {
  await database.table<unknown, WorkflowId>('workflows').put(value);
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('DexieWorkflowRepository', () => {
  test('uses the Locusora database name by default', () => {
    const database = new LocusoraDatabase({
      schemas: workflowDatabaseSchemas,
    });

    expect(database.name).toBe('locusora');

    database.close();
  });

  test('opens the ordered version-1 Workflow schema', async () => {
    const database = createDatabase();

    await database.open();

    expect(database.verno).toBe(1);
    expect(database.tables.map(({ name }) => name)).toContain('workflows');
  });

  test('stores and restores a complete Workflow', async () => {
    const repository = new DexieWorkflowRepository(createDatabase());
    const expected = workflow('one', 'Deep work');

    await repository.save(expected);

    await expect(repository.get(expected.id)).resolves.toEqual(expected);
    await expect(repository.get(expected.id)).resolves.toMatchObject({
      rewardDice: {
        schedule: {
          type: 'frequency',
          triggerPhaseType: 'break',
          frequency: 2,
        },
        rerolls: 3,
      },
    });
  });

  test('round-trips a canonical custom Reward schedule', async () => {
    const repository = new DexieWorkflowRepository(createDatabase());
    const expected = createWorkflow({
      id: 'custom-reward',
      name: 'Custom reward',
      phases: [
        { type: 'focus', durationSeconds: 10, environment: {} },
        { type: 'break', durationSeconds: 10, environment: {} },
      ],
      rewardDice: {
        schedule: { type: 'custom', phaseIndexes: [1] },
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    await repository.save(expected);

    await expect(repository.get(expected.id)).resolves.toEqual(expected);
  });

  test('round-trips a version-2 Workflow with a Role reference', async () => {
    const repository = new DexieWorkflowRepository(createDatabase());
    const expected = createWorkflow({
      id: 'role-workflow',
      name: 'Role workflow',
      phases: [
        {
          type: 'focus',
          durationSeconds: 600,
          environment: { audioAsset: { type: 'role', role: 'Deep Sound' } },
        },
      ],
    });

    await repository.save(expected);

    await expect(repository.get(expected.id)).resolves.toEqual(expected);
  });

  test.each([
    [1, { backgroundAsset: { type: 'direct', assetId: 'image-1' } }],
    [1, { backgroundAssetId: 'image-1', extra: true }],
    [2, { backgroundAssetId: 'image-1' }],
    [
      2,
      { backgroundAsset: { type: 'direct', assetId: 'image-1' }, extra: true },
    ],
  ])(
    'rejects schema v%s Environment fields from another or expanded shape',
    async (schemaVersion, environment) => {
      const store = createDatabase();
      const repository = new DexieWorkflowRepository(store);
      await putWorkflowRecord(store, {
        id: 'wrong-environment',
        schemaVersion,
        order: 0,
        name: 'Wrong',
        phases: [{ type: 'focus', durationSeconds: 10, environment }],
      });

      await expect(
        repository.get(
          createWorkflow({
            id: 'wrong-environment',
            name: 'x',
            phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
          }).id,
        ),
      ).rejects.toBeInstanceOf(WorkflowValidationError);
    },
  );

  test('defaults a legacy stored Reward Dice trigger to focus', async () => {
    const database = createDatabase();
    const repository = new DexieWorkflowRepository(database);
    await database.table<unknown, WorkflowId>('workflows').put({
      id: 'legacy',
      schemaVersion: 1,
      order: 0,
      name: 'Legacy',
      phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea', probability: 0.5 },
          { icon: 'walk', title: 'Walk', probability: 0.5 },
        ],
      },
    });

    await expect(
      repository.get(workflow('legacy', 'Fixture').id),
    ).resolves.toMatchObject({
      rewardDice: {
        schedule: {
          type: 'frequency',
          triggerPhaseType: 'focus',
          frequency: 1,
        },
        rerolls: 0,
      },
    });
  });

  test('maps a real raw version-2 Reward Dice record to frequency schedule', async () => {
    const database = createDatabase();
    const repository = new DexieWorkflowRepository(database);
    await database.table<unknown, WorkflowId>('workflows').put({
      id: 'version-2-reward',
      schemaVersion: 2,
      order: 0,
      name: 'Version 2 reward',
      phases: [{ type: 'break', durationSeconds: 10, environment: {} }],
      rewardDice: {
        triggerPhaseType: 'break',
        frequency: 2,
        sides: [
          { icon: 'tea', title: 'Tea', probability: 0.5 },
          { icon: 'walk', title: 'Walk', probability: 0.5 },
        ],
      },
    });

    await expect(
      repository.get(workflow('version-2-reward', 'Fixture').id),
    ).resolves.toMatchObject({
      rewardDice: {
        schedule: {
          type: 'frequency',
          triggerPhaseType: 'break',
          frequency: 2,
        },
      },
    });
  });

  test('rejects a version-3 frequency schedule without triggerPhaseType', async () => {
    const database = createDatabase();
    const repository = new DexieWorkflowRepository(database);
    await database.table<unknown, WorkflowId>('workflows').put({
      id: 'invalid-canonical',
      schemaVersion: 3,
      order: 0,
      name: 'Invalid canonical',
      phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      rewardDice: {
        schedule: { type: 'frequency', frequency: 1 },
        rerolls: 0,
        sides: [
          { icon: 'tea', title: 'Tea', probability: 0.5 },
          { icon: 'walk', title: 'Walk', probability: 0.5 },
        ],
      },
    });

    await expect(
      repository.get(workflow('invalid-canonical', 'Fixture').id),
    ).rejects.toBeInstanceOf(WorkflowValidationError);
  });

  test('appends new Workflows and lists them in stable order', async () => {
    const repository = new DexieWorkflowRepository(createDatabase());
    const first = workflow('one', 'First');
    const second = workflow('two', 'Second');

    await repository.save(first);
    await repository.save(second);

    await expect(repository.list()).resolves.toEqual([first, second]);
  });

  test('updates a Workflow without changing its order', async () => {
    const repository = new DexieWorkflowRepository(createDatabase());
    const first = workflow('one', 'First');
    const second = workflow('two', 'Second');
    const updated = workflow('one', 'Updated');
    await repository.save(first);
    await repository.save(second);

    await repository.save(updated);

    await expect(repository.list()).resolves.toEqual([updated, second]);
  });

  test('replaces Workflow order atomically', async () => {
    const repository = new DexieWorkflowRepository(createDatabase());
    const first = workflow('one', 'First');
    const second = workflow('two', 'Second');
    await repository.save(first);
    await repository.save(second);

    await repository.replaceOrder([second.id, first.id]);

    await expect(repository.list()).resolves.toEqual([second, first]);
  });

  test('deletes a Workflow and closes the ordering gap', async () => {
    const repository = new DexieWorkflowRepository(createDatabase());
    const first = workflow('one', 'First');
    const second = workflow('two', 'Second');
    await repository.save(first);
    await repository.save(second);

    await repository.delete(first.id);

    await expect(repository.get(first.id)).resolves.toBeNull();
    await expect(repository.list()).resolves.toEqual([second]);
  });

  test('returns null for a missing Workflow', async () => {
    const repository = new DexieWorkflowRepository(createDatabase());
    const missingId = workflow('missing', 'Missing').id;

    await expect(repository.get(missingId)).resolves.toBeNull();
  });

  test('rejects a corrupted persistence record at the boundary', async () => {
    const database = createDatabase();
    const repository = new DexieWorkflowRepository(database);
    await database.table<unknown, WorkflowId>('workflows').put(
      {
        id: 'corrupted',
        schemaVersion: 1,
        order: 0,
        name: '',
        phases: [],
      },
      workflow('corrupted', 'Fixture').id,
    );

    await expect(
      repository.get(workflow('corrupted', 'Fixture').id),
    ).rejects.toBeInstanceOf(WorkflowValidationError);
  });
});
