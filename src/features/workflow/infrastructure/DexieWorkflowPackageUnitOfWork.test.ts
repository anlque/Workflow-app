import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test } from 'vitest';

import {
  assetDatabaseSchemas,
  createAsset,
  DexieAssetRepository,
} from '@/features/assets';
import { FlowariumDatabase } from '@/platform/storage';

import { workflowDatabaseSchemas } from './WorkflowRecord';
import { DexieWorkflowPackageUnitOfWork } from './DexieWorkflowPackageUnitOfWork';

const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe('DexieWorkflowPackageUnitOfWork', () => {
  test('rolls back Asset writes when the package operation fails', async () => {
    const name = `flowarium-package-test-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const database = new FlowariumDatabase({
      name,
      schemas: [...workflowDatabaseSchemas, ...assetDatabaseSchemas],
    });
    const assets = new DexieAssetRepository(database);
    const unitOfWork = new DexieWorkflowPackageUnitOfWork(database);
    const blob = new Blob(['x'], { type: 'image/png' });
    const asset = createAsset({
      id: 'asset-1',
      name: 'Image',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1_000,
    });

    await expect(
      unitOfWork.run(async () => {
        await assets.save(asset, blob);
        throw new Error('Workflow write failed.');
      }),
    ).rejects.toThrow('Workflow write failed.');

    await expect(assets.getBlob(asset.id)).resolves.toBeNull();
  });
});
