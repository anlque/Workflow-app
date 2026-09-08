import { describe, expect, test } from 'vitest';

import { createAsset, createAssetRole, type Asset } from '../domain/Asset';
import type { AssetRoleRepository } from './AssetRoleRepository';
import {
  resolveAssetRoleUseCase,
  UnresolvedAssetRoleError,
  WrongKindAssetRoleError,
} from './resolveAssetRoleUseCase';

function repository(asset: Asset | null): AssetRoleRepository {
  return {
    findByRole: () => Promise.resolve(asset),
    moveRole: () => Promise.resolve(),
  };
}

const image = createAsset({
  id: 'image-1',
  name: 'Image',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 1,
  role: 'Backdrop',
});

describe('resolveAssetRoleUseCase', () => {
  test('returns the owner only when its kind matches', async () => {
    await expect(
      resolveAssetRoleUseCase(
        repository(image),
        createAssetRole('backdrop'),
        'image',
      ),
    ).resolves.toBe(image.id);
  });

  test('distinguishes unresolved and wrong-kind Roles', async () => {
    await expect(
      resolveAssetRoleUseCase(
        repository(null),
        createAssetRole('missing'),
        'image',
      ),
    ).rejects.toBeInstanceOf(UnresolvedAssetRoleError);
    await expect(
      resolveAssetRoleUseCase(
        repository(image),
        createAssetRole('backdrop'),
        'audio',
      ),
    ).rejects.toBeInstanceOf(WrongKindAssetRoleError);
  });
});
