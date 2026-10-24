import 'fake-indexeddb/auto';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { LocusoraDatabase } from '@/platform/storage';

import { convertQuickWorkflowUseCase } from '../application/convertQuickWorkflowUseCase';
import { WorkflowApplicationError } from '../application/WorkflowApplicationError';
import type { WorkflowRepository } from '../application/WorkflowRepository';
import { createWorkflow } from '../domain/createWorkflow';
import { createWorkflowId } from '../domain/Workflow';
import type { QuickWorkflow } from '../domain/QuickWorkflow';
import { DexieWorkflowConversionUnitOfWork } from './DexieWorkflowConversionUnitOfWork';
import { DexieWorkflowRepository } from './DexieWorkflowRepository';
import type { WorkflowRecord } from './WorkflowRecord';
import { workflowDatabaseSchemas } from './WorkflowRecord';

const databases: LocusoraDatabase[] = [];

function database() {
  const value = new LocusoraDatabase({
    name: `locusora-conversion-${crypto.randomUUID()}`,
    schemas: workflowDatabaseSchemas,
  });
  databases.push(value);
  return value;
}

function quick(id = 'quick'): QuickWorkflow {
  const workflow = createWorkflow({
    mode: 'quick',
    id,
    name: 'Quick rhythm',
    configuration: {
      cycleCount: 1,
      focus: { durationSeconds: 1_500, environment: {} },
      shortBreak: { durationSeconds: 300, environment: {} },
    },
  });
  if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow.');
  return workflow;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((value) => value.delete()));
  vi.restoreAllMocks();
});

describe('DexieWorkflowConversionUnitOfWork', () => {
  test('commits replacement, retained copy and complete order atomically', async () => {
    const db = database();
    const repository = new DexieWorkflowRepository(db);
    const source = quick();
    const other = quick('other');
    await repository.save(source);
    await repository.save(other);

    await convertQuickWorkflowUseCase(
      repository,
      new DexieWorkflowConversionUnitOfWork(db),
      {
        sourceId: source.id,
        input: {
          mode: 'quick',
          id: source.id,
          name: 'Edited rhythm',
          configuration: source.configuration,
        },
        copyId: createWorkflowId('copy'),
      },
    );

    const values = await repository.list();
    expect(values.map(({ id, mode }) => [id, mode])).toEqual([
      ['copy', 'quick'],
      ['other', 'quick'],
      ['quick', 'detailed'],
    ]);
    expect(values[0]?.name).toBe('Edited rhythm (Quick copy)');
    expect(values[2]?.name).toBe('Edited rhythm');
  });

  test.each([
    ['replacement', 'put'],
    ['copy', 'add'],
    ['order', 'bulkPut'],
  ] as const)(
    'rolls back every write when %s fails',
    async (_stage, method) => {
      const db = database();
      const repository = new DexieWorkflowRepository(db);
      const source = quick();
      const other = quick('other');
      await repository.save(source);
      await repository.save(other);
      const before = await repository.list();
      const table = db.table<WorkflowRecord, string>('workflows');
      vi.spyOn(table, method).mockRejectedValueOnce(
        new Error(`${method} failed`),
      );

      await expect(
        convertQuickWorkflowUseCase(
          repository,
          new DexieWorkflowConversionUnitOfWork(db),
          {
            sourceId: source.id,
            input: {
              mode: 'quick',
              id: source.id,
              name: 'Edited rhythm',
              configuration: source.configuration,
            },
            copyId: createWorkflowId('copy'),
          },
        ),
      ).rejects.toThrow(`${method} failed`);

      await expect(repository.list()).resolves.toEqual(before);
    },
  );

  test('allows only one concurrent conversion of the same Quick source', async () => {
    const db = database();
    const repository = new DexieWorkflowRepository(db);
    const source = quick();
    await repository.save(source);

    let pendingReads = 0;
    let releaseReads!: () => void;
    const readsReady = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const concurrentRepository: WorkflowRepository = {
      get: (id) => repository.get(id),
      save: (workflow) => repository.save(workflow),
      delete: (id) => repository.delete(id),
      replaceOrder: (ids) => repository.replaceOrder(ids),
      async list() {
        const workflows = await repository.list();
        pendingReads += 1;
        if (pendingReads === 2) releaseReads();
        await readsReady;
        return workflows;
      },
    };
    const input = {
      sourceId: source.id,
      input: {
        mode: 'quick' as const,
        id: source.id,
        name: source.name,
        configuration: source.configuration,
      },
    };

    const results = await Promise.allSettled([
      convertQuickWorkflowUseCase(
        concurrentRepository,
        new DexieWorkflowConversionUnitOfWork(db),
        input,
      ),
      convertQuickWorkflowUseCase(
        concurrentRepository,
        new DexieWorkflowConversionUnitOfWork(db),
        input,
      ),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const rejected = results.find(({ status }) => status === 'rejected');
    if (rejected?.status !== 'rejected')
      throw new Error('Expected one rejected conversion.');
    const reason: unknown = rejected.reason;
    expect(reason).toBeInstanceOf(WorkflowApplicationError);
    expect((reason as Error).message).toBe(
      'Only a Quick Workflow can be converted.',
    );
    const workflows = await repository.list();
    expect(workflows.map(({ id, mode }) => [id, mode])).toEqual([
      [source.id, 'detailed'],
    ]);
  });
});
