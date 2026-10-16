import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test } from 'vitest';

import { type AssetImportPolicy } from '@/features/assets';
import {
  DexieStarterContentUnitOfWork,
  seedStarterContentUseCase,
  StarterContentConflictError,
} from '@/features/starter-content';
import { createWorkflow, DexieWorkflowRepository } from '@/features/workflow';

import { createProductionDatabase } from '../databaseSchemas';
import { starterContentSeeds } from './starterContentSeeds';

const databaseNames: string[] = [];
const assetPolicy: AssetImportPolicy = {
  image: { maxBytes: 1_024, mimeTypes: ['image/webp'] },
  audio: { maxBytes: 1_024, mimeTypes: ['audio/ogg'] },
};

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

function setup() {
  const name = `starter-workflows-${crypto.randomUUID()}`;
  databaseNames.push(name);
  const database = createProductionDatabase(name);
  const unitOfWork = new DexieStarterContentUnitOfWork(database);
  const workflows = new DexieWorkflowRepository(database);
  const versionTwo = starterContentSeeds[1];
  if (versionTwo === undefined) throw new Error('Seed version 2 missing.');
  const [quickInput, balancedInput] = versionTwo.workflows;
  if (quickInput === undefined || balancedInput === undefined) {
    throw new Error('Starter Workflow definition missing.');
  }
  return {
    database,
    unitOfWork,
    workflows,
    versionTwo,
    quickInput,
    balancedInput,
    dependencies: {
      assetPolicy,
      files: {
        load: () => Promise.reject(new Error('v2 must not load a file')),
      },
      registry: unitOfWork,
      unitOfWork,
      now: () => 200,
    },
  };
}

describe('starter Workflow seed integration', () => {
  test('installs v2 once after v1 while preserving ordinary user ordering and edits', async () => {
    const {
      database,
      unitOfWork,
      workflows,
      versionTwo,
      quickInput,
      balancedInput,
      dependencies,
    } = setup();
    await workflows.save(
      createWorkflow({
        id: 'user-workflow',
        name: 'User workflow',
        phases: [{ type: 'focus', durationSeconds: 600, environment: {} }],
      }),
    );
    await unitOfWork.run((transaction) => transaction.complete(1, 100));

    await expect(
      seedStarterContentUseCase(dependencies, versionTwo),
    ).resolves.toBe('seeded');
    expect((await workflows.list()).map(({ name }) => name)).toEqual([
      'User workflow',
      'Quick Focus',
      'Balanced Flow',
      'Reward Journey',
    ]);
    expect(await unitOfWork.isCompleted(2)).toBe(true);

    const quickId = createWorkflow(quickInput).id;
    const quickFocus = await workflows.get(quickId);
    if (quickFocus === null) throw new Error('Quick Focus missing.');
    await workflows.save(createWorkflow({ ...quickFocus, name: 'My focus' }));
    const balancedId = createWorkflow(balancedInput).id;
    await workflows.delete(balancedId);

    await expect(
      seedStarterContentUseCase(dependencies, versionTwo),
    ).resolves.toBe('already-completed');
    expect(await workflows.get(balancedId)).toBeNull();
    expect((await workflows.get(quickId))?.name).toBe('My focus');
    expect((await workflows.list()).map(({ name }) => name)).toEqual([
      'User workflow',
      'My focus',
      'Reward Journey',
    ]);
    database.close();
  });

  test('rolls back every v2 record when a deterministic Workflow ID conflicts', async () => {
    const {
      database,
      unitOfWork,
      workflows,
      versionTwo,
      balancedInput,
      dependencies,
    } = setup();
    await unitOfWork.run((transaction) => transaction.complete(1, 100));
    await workflows.save(
      createWorkflow({
        ...balancedInput,
        name: 'Existing conflicting Workflow',
      }),
    );

    await expect(
      seedStarterContentUseCase(dependencies, versionTwo),
    ).rejects.toBeInstanceOf(StarterContentConflictError);
    expect((await workflows.list()).map(({ name }) => name)).toEqual([
      'Existing conflicting Workflow',
    ]);
    expect(await unitOfWork.isCompleted(2)).toBe(false);
    database.close();
  });
});
