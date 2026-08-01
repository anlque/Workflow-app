import { describe, expect, test } from 'vitest';

import type { Asset, AssetId } from '../domain/Asset';
import type { AssetRepository } from './AssetRepository';
import { deleteAssetUseCase } from './deleteAssetUseCase';
import {
  importAssetUseCase,
  type AssetImportPolicy,
} from './importAssetUseCase';

class InMemoryAssetRepository implements AssetRepository {
  readonly assets = new Map<AssetId, Readonly<{ asset: Asset; blob: Blob }>>();
  saveCalls = 0;

  public list(): Promise<readonly Asset[]> {
    return Promise.resolve([...this.assets.values()].map(({ asset }) => asset));
  }

  public getBlob(id: AssetId): Promise<Blob | null> {
    return Promise.resolve(this.assets.get(id)?.blob ?? null);
  }

  public save(asset: Asset, blob: Blob): Promise<void> {
    this.saveCalls += 1;
    this.assets.set(asset.id, { asset, blob });
    return Promise.resolve();
  }

  public delete(id: AssetId): Promise<void> {
    this.assets.delete(id);
    return Promise.resolve();
  }
}

const policy: AssetImportPolicy = {
  image: { maxBytes: 5, mimeTypes: ['image/png'] },
  audio: { maxBytes: 8, mimeTypes: ['audio/mpeg'] },
};

describe('Asset use cases', () => {
  test.each([
    ['image', 'image/png', 5],
    ['audio', 'audio/mpeg', 8],
  ] as const)('imports an allowed %s', async (kind, mimeType, size) => {
    const repository = new InMemoryAssetRepository();
    const blob = new Blob([new Uint8Array(size)], { type: mimeType });

    const asset = await importAssetUseCase(repository, policy, {
      id: 'asset-1',
      name: 'Local media',
      kind,
      blob,
      createdAt: 1_000,
    });

    expect(asset).toEqual({
      id: 'asset-1',
      name: 'Local media',
      kind,
      mimeType,
      byteSize: size,
      createdAt: 1_000,
    });
    await expect(repository.getBlob(asset.id)).resolves.toBe(blob);
  });

  test.each([
    ['empty', new Blob([], { type: 'image/png' }), 'image'],
    ['unsupported', new Blob(['x'], { type: 'image/jpeg' }), 'image'],
    ['oversized', new Blob(['123456'], { type: 'image/png' }), 'image'],
    ['kind mismatch', new Blob(['x'], { type: 'audio/mpeg' }), 'image'],
  ] as const)(
    'rejects %s content before writing',
    async (_case, blob, kind) => {
      const repository = new InMemoryAssetRepository();

      await expect(
        importAssetUseCase(repository, policy, {
          id: 'asset-1',
          name: 'Local media',
          kind,
          blob,
          createdAt: 1_000,
        }),
      ).rejects.toThrow();
      expect(repository.saveCalls).toBe(0);
    },
  );

  test('rejects deletion while a Workflow references the Asset', async () => {
    const repository = new InMemoryAssetRepository();
    const asset = await importAssetUseCase(repository, policy, {
      id: 'asset-1',
      name: 'Local media',
      kind: 'image',
      blob: new Blob(['x'], { type: 'image/png' }),
      createdAt: 1_000,
    });

    await expect(
      deleteAssetUseCase(
        repository,
        { count: () => Promise.resolve(1) },
        asset.id,
      ),
    ).rejects.toThrow('Asset is referenced by 1 Workflow.');
    await expect(repository.getBlob(asset.id)).resolves.not.toBeNull();
  });

  test('deletes an unreferenced Asset', async () => {
    const repository = new InMemoryAssetRepository();
    const asset = await importAssetUseCase(repository, policy, {
      id: 'asset-1',
      name: 'Local media',
      kind: 'image',
      blob: new Blob(['x'], { type: 'image/png' }),
      createdAt: 1_000,
    });

    await deleteAssetUseCase(
      repository,
      { count: () => Promise.resolve(0) },
      asset.id,
    );

    await expect(repository.getBlob(asset.id)).resolves.toBeNull();
  });
});
