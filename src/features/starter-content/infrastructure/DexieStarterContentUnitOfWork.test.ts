import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test } from 'vitest';

import {
  assetDatabaseSchemas,
  createAsset,
  DexieAssetRepository,
} from '@/features/assets';
import { sessionDatabaseSchemas } from '@/features/session';
import {
  createWorkflow,
  DexieWorkflowRepository,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { LocusoraDatabase } from '@/platform/storage';

import { StarterContentValidationError } from '../application/StarterContentErrors';
import { starterContentDatabaseSchemas } from './StarterContentSeedRecord';
import { DexieStarterContentUnitOfWork } from './DexieStarterContentUnitOfWork';

const databaseNames: string[] = [];

function database(
  schemas = [
    ...workflowDatabaseSchemas,
    ...sessionDatabaseSchemas,
    ...assetDatabaseSchemas,
    ...starterContentDatabaseSchemas,
  ],
): LocusoraDatabase {
  const name = `starter-content-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return new LocusoraDatabase({ name, schemas });
}

const asset = createAsset({
  id: 'locusora:seed:v1:asset:forest',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/webp',
  byteSize: 5,
  createdAt: 123,
  role: 'Starter forest',
});
const blob = new Blob(['image'], { type: 'image/webp' });
const workflow = createWorkflow({
  id: 'locusora:seed:v1:workflow:focus',
  name: 'Starter focus',
  phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
});

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe('DexieStarterContentUnitOfWork', () => {
  test('adds Assets, Workflows and the completion marker atomically', async () => {
    const db = database();
    const unitOfWork = new DexieStarterContentUnitOfWork(db);

    await unitOfWork.run(async (transaction) => {
      expect(await transaction.isCompleted(1)).toBe(false);
      await transaction.addAsset(asset, blob);
      await transaction.addWorkflow(workflow);
      await transaction.complete(1, 123);
    });

    expect(await unitOfWork.isCompleted(1)).toBe(true);
    expect(await new DexieAssetRepository(db).get(asset.id)).toEqual(asset);
    expect(await new DexieWorkflowRepository(db).get(workflow.id)).toEqual(
      workflow,
    );
    db.close();
  });

  test.each(['asset', 'workflow', 'marker'] as const)(
    'rolls back the transaction after a failure following the %s stage',
    async (stage) => {
      const db = database();
      const unitOfWork = new DexieStarterContentUnitOfWork(db);

      await expect(
        unitOfWork.run(async (transaction) => {
          await transaction.addAsset(asset, blob);
          if (stage === 'asset') throw new Error('stop after asset');
          await transaction.addWorkflow(workflow);
          if (stage === 'workflow') throw new Error('stop after workflow');
          await transaction.complete(1, 123);
          throw new Error('stop after marker');
        }),
      ).rejects.toThrow(`stop after ${stage}`);

      expect(await new DexieAssetRepository(db).get(asset.id)).toBeNull();
      expect(await new DexieWorkflowRepository(db).get(workflow.id)).toBeNull();
      expect(await unitOfWork.isCompleted(1)).toBe(false);
      db.close();
    },
  );

  test('rejects a malformed stored marker', async () => {
    const db = database();
    await db.table('starterContentSeeds').add({
      version: 1,
      completedAt: 'not-a-number',
    });

    await expect(
      new DexieStarterContentUnitOfWork(db).isCompleted(1),
    ).rejects.toBeInstanceOf(StarterContentValidationError);
    db.close();
  });

  test('serializes concurrent transactions from separate adapters', async () => {
    const db = database();
    const first = new DexieStarterContentUnitOfWork(db);
    const second = new DexieStarterContentUnitOfWork(db);
    const insert = async (unitOfWork: DexieStarterContentUnitOfWork) =>
      unitOfWork.run(async (transaction) => {
        if (await transaction.isCompleted(1)) return 'already-completed';
        await transaction.addAsset(asset, blob);
        await transaction.addWorkflow(workflow);
        await transaction.complete(1, 123);
        return 'seeded';
      });

    await expect(Promise.all([insert(first), insert(second)])).resolves.toEqual(
      ['seeded', 'already-completed'],
    );
    expect(await db.table('assets').count()).toBe(1);
    expect(await db.table('workflows').count()).toBe(1);
    expect(await db.table('starterContentSeeds').count()).toBe(1);
    db.close();
  });

  test('upgrades a populated global version-4 database without changing existing rows', async () => {
    const name = `starter-content-upgrade-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const previous = new LocusoraDatabase({
      name,
      schemas: [
        ...workflowDatabaseSchemas,
        ...sessionDatabaseSchemas,
        ...assetDatabaseSchemas,
      ],
    });
    await previous.table('assets').add({ id: 'asset-before-upgrade' });
    await previous.table('workflows').add({ id: 'workflow-before-upgrade' });
    await previous.table('sessions').add({ id: 'session-before-upgrade' });
    previous.close();

    const upgraded = new LocusoraDatabase({
      name,
      schemas: [
        ...workflowDatabaseSchemas,
        ...sessionDatabaseSchemas,
        ...assetDatabaseSchemas,
        ...starterContentDatabaseSchemas,
      ],
    });

    expect(await upgraded.table('assets').get('asset-before-upgrade')).toEqual({
      id: 'asset-before-upgrade',
    });
    expect(
      await upgraded.table('workflows').get('workflow-before-upgrade'),
    ).toEqual({ id: 'workflow-before-upgrade' });
    expect(
      await upgraded.table('sessions').get('session-before-upgrade'),
    ).toEqual({ id: 'session-before-upgrade' });
    expect(await upgraded.table('starterContentSeeds').count()).toBe(0);
    upgraded.close();
  });
});
