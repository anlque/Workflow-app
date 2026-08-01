import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { FlowariumDatabase } from '@/platform/storage';

import { createAsset } from '../domain/Asset';
import { AssetStorageError, AssetValidationError } from '../domain/AssetErrors';
import { BrowserAssetUrlService } from './BrowserAssetUrlService';
import { DexieAssetRepository } from './DexieAssetRepository';
import { assetDatabaseSchemas } from './AssetRecord';

const databaseNames: string[] = [];

function database(): FlowariumDatabase {
  const name = `flowarium-asset-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return new FlowariumDatabase({ name, schemas: assetDatabaseSchemas });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe('DexieAssetRepository', () => {
  test('atomically stores metadata and its Blob', async () => {
    const repository = new DexieAssetRepository(database());
    const asset = createAsset({
      id: 'asset-1',
      name: 'Rain',
      kind: 'audio',
      mimeType: 'audio/mpeg',
      byteSize: 4,
      createdAt: 1_000,
    });
    const blob = new Blob(['rain'], { type: 'audio/mpeg' });

    await repository.save(asset, blob);

    await expect(repository.list()).resolves.toEqual([asset]);
    await expect(repository.getBlob(asset.id)).resolves.toEqual(blob);
  });

  test('rejects a corrupt persisted record', async () => {
    const store = database();
    const repository = new DexieAssetRepository(store);
    await store.table('assets').put({
      id: 'broken',
      schemaVersion: 1,
      createdAt: 1_000,
      blob: 'not-a-blob',
    });

    await expect(repository.list()).rejects.toBeInstanceOf(
      AssetValidationError,
    );
  });

  test('normalizes quota errors', async () => {
    const store = database();
    const repository = new DexieAssetRepository(store);
    vi.spyOn(store.table('assets'), 'put').mockRejectedValue(
      new DOMException('Quota exceeded', 'QuotaExceededError'),
    );
    const blob = new Blob(['x'], { type: 'image/png' });
    const asset = createAsset({
      id: 'asset-1',
      name: 'Image',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1_000,
    });

    await expect(repository.save(asset, blob)).rejects.toBeInstanceOf(
      AssetStorageError,
    );
  });
});

describe('BrowserAssetUrlService', () => {
  test('creates and revokes object URLs', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:asset');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const service = new BrowserAssetUrlService();

    const url = service.create(blob);
    service.revoke(url);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:asset');
  });
});
