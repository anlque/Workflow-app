import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { LocusoraDatabase } from '@/platform/storage';

import { createAsset, createAssetRole } from '../domain/Asset';
import {
  AssetRoleConflictError,
  AssetStorageError,
  AssetValidationError,
} from '../domain/AssetErrors';
import { BrowserAssetUrlService } from './BrowserAssetUrlService';
import { DexieAssetRepository } from './DexieAssetRepository';
import { assetDatabaseSchemas } from './AssetRecord';

const databaseNames: string[] = [];

function database(): LocusoraDatabase {
  const name = `locusora-asset-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return new LocusoraDatabase({ name, schemas: assetDatabaseSchemas });
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

  test('round-trips Roles and finds them by normalized key', async () => {
    const repository = new DexieAssetRepository(database());
    const blob = new Blob(['rain'], { type: 'audio/mpeg' });
    const asset = createAsset({
      id: 'asset-1',
      name: 'Rain',
      kind: 'audio',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1_000,
      role: 'Fav Focus',
    });

    await repository.save(asset, blob);

    await expect(
      repository.findByRole(createAssetRole(' fav\tFOCUS ')),
    ).resolves.toEqual(asset);
    await expect(repository.list()).resolves.toEqual([asset]);
  });

  test('reads legacy version-1 Assets without a Role', async () => {
    const store = database();
    const repository = new DexieAssetRepository(store);
    const blob = new Blob(['x'], { type: 'image/png' });
    await store.table('assets').put({
      id: 'legacy',
      schemaVersion: 1,
      name: 'Legacy',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      blob,
    });

    await expect(repository.list()).resolves.toEqual([
      createAsset({
        id: 'legacy',
        name: 'Legacy',
        kind: 'image',
        mimeType: blob.type,
        byteSize: blob.size,
        createdAt: 1,
      }),
    ]);
  });

  test('upgrades a version-3 Asset table and preserves legacy rows', async () => {
    const name = `locusora-asset-upgrade-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const legacy = new Dexie(name);
    legacy.version(3).stores({ assets: 'id, createdAt' });
    const blob = new Blob(['x'], { type: 'image/png' });
    await legacy.table('assets').put({
      id: 'legacy',
      schemaVersion: 1,
      name: 'Legacy',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      blob,
    });
    legacy.close();

    const upgraded = new LocusoraDatabase({
      name,
      schemas: assetDatabaseSchemas,
    });
    const repository = new DexieAssetRepository(upgraded);

    await expect(repository.list()).resolves.toHaveLength(1);
    expect(upgraded.verno).toBe(4);
    expect(
      upgraded.table('assets').schema.indexes.map(({ name }) => name),
    ).toContain('roleKey');
  });

  test('enforces global normalized Role uniqueness across Asset kinds', async () => {
    const repository = new DexieAssetRepository(database());
    const audioBlob = new Blob(['a'], { type: 'audio/mpeg' });
    const imageBlob = new Blob(['i'], { type: 'image/png' });
    await repository.save(
      createAsset({
        id: 'audio',
        name: 'Audio',
        kind: 'audio',
        mimeType: audioBlob.type,
        byteSize: audioBlob.size,
        createdAt: 1,
        role: 'Deep Focus',
      }),
      audioBlob,
    );

    await expect(
      repository.save(
        createAsset({
          id: 'image',
          name: 'Image',
          kind: 'image',
          mimeType: imageBlob.type,
          byteSize: imageBlob.size,
          createdAt: 2,
          role: ' deep\tFOCUS ',
        }),
        imageBlob,
      ),
    ).rejects.toBeInstanceOf(AssetRoleConflictError);
  });

  test('rejects a version-2 record with a forged Role key', async () => {
    const store = database();
    const repository = new DexieAssetRepository(store);
    const blob = new Blob(['x'], { type: 'image/png' });
    await store.table('assets').put({
      id: 'broken-role',
      schemaVersion: 2,
      name: 'Broken',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Focus',
      roleKey: 'not-focus',
      blob,
    });

    await expect(repository.list()).rejects.toBeInstanceOf(
      AssetValidationError,
    );
  });

  test('rejects Role fields on a version-1 Asset record', async () => {
    const store = database();
    const repository = new DexieAssetRepository(store);
    const blob = new Blob(['x'], { type: 'image/png' });
    await store.table('assets').put({
      id: 'legacy-with-role',
      schemaVersion: 1,
      name: 'Broken legacy',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Backdrop',
      roleKey: 'backdrop',
      blob,
    });

    await expect(repository.list()).rejects.toBeInstanceOf(
      AssetValidationError,
    );
  });

  test('moves a Role atomically between Assets', async () => {
    const repository = new DexieAssetRepository(database());
    const blob = new Blob(['x'], { type: 'image/png' });
    const source = createAsset({
      id: 'source',
      name: 'Source',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Backdrop',
    });
    const target = createAsset({
      id: 'target',
      name: 'Target',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 2,
    });
    await repository.save(source, blob);
    await repository.save(target, blob);

    await repository.moveRole(target.id, createAssetRole('BACKDROP'));

    const assets = await repository.list();
    expect(assets.find(({ id }) => id === source.id)?.role).toBeUndefined();
    expect(assets.find(({ id }) => id === target.id)?.role).toBe('BACKDROP');
  });

  test('assigns an unowned Role to a target', async () => {
    const repository = new DexieAssetRepository(database());
    const blob = new Blob(['x'], { type: 'image/png' });
    const target = createAsset({
      id: 'target',
      name: 'Target',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
    });
    await repository.save(target, blob);

    await repository.moveRole(target.id, createAssetRole('Backdrop'));

    await expect(
      repository.findByRole(createAssetRole('backdrop')),
    ).resolves.toMatchObject({ id: target.id, role: 'Backdrop' });
  });

  test('moves a globally unique Role across Asset kinds', async () => {
    const repository = new DexieAssetRepository(database());
    const imageBlob = new Blob(['i'], { type: 'image/png' });
    const audioBlob = new Blob(['a'], { type: 'audio/mpeg' });
    const source = createAsset({
      id: 'image',
      name: 'Image',
      kind: 'image',
      mimeType: imageBlob.type,
      byteSize: imageBlob.size,
      createdAt: 1,
      role: 'Primary',
    });
    const target = createAsset({
      id: 'audio',
      name: 'Audio',
      kind: 'audio',
      mimeType: audioBlob.type,
      byteSize: audioBlob.size,
      createdAt: 2,
    });
    await repository.save(source, imageBlob);
    await repository.save(target, audioBlob);

    await repository.moveRole(target.id, createAssetRole('Primary'));

    await expect(
      repository.findByRole(createAssetRole('primary')),
    ).resolves.toMatchObject({ id: target.id, kind: 'audio' });
    expect(
      (await repository.list()).find(({ id }) => id === source.id)?.role,
    ).toBeUndefined();
  });

  test('treats moving a Role to its current owner as idempotent', async () => {
    const repository = new DexieAssetRepository(database());
    const blob = new Blob(['x'], { type: 'image/png' });
    const target = createAsset({
      id: 'target',
      name: 'Target',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Backdrop',
    });
    await repository.save(target, blob);

    await repository.moveRole(target.id, createAssetRole('backdrop'));

    await expect(repository.list()).resolves.toEqual([target]);
  });

  test('rejects a missing Role move target without changing the owner', async () => {
    const repository = new DexieAssetRepository(database());
    const blob = new Blob(['x'], { type: 'image/png' });
    const source = createAsset({
      id: 'source',
      name: 'Source',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Backdrop',
    });
    await repository.save(source, blob);

    await expect(
      repository.moveRole(
        createAsset({ ...source, id: 'missing' }).id,
        createAssetRole('Backdrop'),
      ),
    ).rejects.toThrow('Target Asset was not found.');
    await expect(repository.list()).resolves.toEqual([source]);
  });

  test('leaves both Assets unchanged when a move target owns another Role', async () => {
    const repository = new DexieAssetRepository(database());
    const blob = new Blob(['x'], { type: 'image/png' });
    const source = createAsset({
      id: 'source',
      name: 'Source',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Backdrop',
    });
    const target = createAsset({
      id: 'target',
      name: 'Target',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 2,
      role: 'Ambient',
    });
    await repository.save(source, blob);
    await repository.save(target, blob);

    await expect(
      repository.moveRole(target.id, createAssetRole('Backdrop')),
    ).rejects.toBeInstanceOf(AssetRoleConflictError);

    await expect(repository.list()).resolves.toEqual([source, target]);
  });

  test('rolls back the cleared owner when the second Role move write fails', async () => {
    const store = database();
    const repository = new DexieAssetRepository(store);
    const blob = new Blob(['x'], { type: 'image/png' });
    const source = createAsset({
      id: 'source',
      name: 'Source',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Backdrop',
    });
    const target = createAsset({
      id: 'target',
      name: 'Target',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 2,
    });
    await repository.save(source, blob);
    await repository.save(target, blob);
    const table = store.table('assets');
    const originalPut = table.put.bind(table);
    let writes = 0;
    vi.spyOn(table, 'put').mockImplementation((value, key) => {
      writes += 1;
      return writes === 2
        ? Dexie.Promise.reject(new Error('target write failed'))
        : originalPut(value, key);
    });

    await expect(
      repository.moveRole(target.id, createAssetRole('Backdrop')),
    ).rejects.toThrow('target write failed');

    await expect(repository.list()).resolves.toEqual([source, target]);
  });

  test('enforces Role uniqueness across concurrent repository writes', async () => {
    const name = `locusora-asset-concurrent-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const firstRepository = new DexieAssetRepository(
      new LocusoraDatabase({ name, schemas: assetDatabaseSchemas }),
    );
    const secondRepository = new DexieAssetRepository(
      new LocusoraDatabase({ name, schemas: assetDatabaseSchemas }),
    );
    const blob = new Blob(['x'], { type: 'image/png' });
    const asset = (id: string, role: string) =>
      createAsset({
        id,
        name: id,
        kind: 'image',
        mimeType: blob.type,
        byteSize: blob.size,
        createdAt: id === 'one' ? 1 : 2,
        role,
      });

    const results = await Promise.allSettled([
      firstRepository.save(asset('one', 'Backdrop'), blob),
      secondRepository.save(asset('two', ' backdrop '), blob),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    const rejection = results.find(({ status }) => status === 'rejected');
    if (rejection?.status !== 'rejected') {
      throw new Error('Expected one concurrent Role write to reject.');
    }
    const reason: unknown = rejection.reason;
    expect(reason).toBeInstanceOf(AssetRoleConflictError);
    await expect(firstRepository.list()).resolves.toHaveLength(1);
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
