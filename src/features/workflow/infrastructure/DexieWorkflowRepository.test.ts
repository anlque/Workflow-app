import 'fake-indexeddb/auto';

import { afterEach, describe, expect, test } from 'vitest';

import { FlowariumDatabase } from '@/platform/storage';

import { createWorkflow } from '../domain/createWorkflow';
import type { Workflow, WorkflowId } from '../domain/Workflow';
import { WorkflowValidationError } from '../domain/WorkflowErrors';
import { DexieWorkflowRepository } from './DexieWorkflowRepository';
import { workflowDatabaseSchemas } from './WorkflowRecord';

const databases: FlowariumDatabase[] = [];

function createDatabase(): FlowariumDatabase {
  const database = new FlowariumDatabase({
    name: `flowarium-workflow-test-${crypto.randomUUID()}`,
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

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('DexieWorkflowRepository', () => {
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
      rewardDice: { triggerPhaseType: 'break', rerolls: 3 },
    });
  });

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
      rewardDice: { triggerPhaseType: 'focus', rerolls: 0 },
    });
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
