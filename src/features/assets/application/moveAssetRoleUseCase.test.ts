import { describe, expect, test, vi } from 'vitest';

import { createAssetId, createAssetRole } from '../domain/Asset';
import type { AssetRoleRepository } from './AssetRoleRepository';
import { moveAssetRoleUseCase } from './moveAssetRoleUseCase';

describe('moveAssetRoleUseCase', () => {
  test('normalizes input and delegates one atomic repository operation', async () => {
    const moveRole = vi.fn<AssetRoleRepository['moveRole']>(() =>
      Promise.resolve(),
    );
    const repository = {
      moveRole,
      findByRole: () => Promise.resolve(null),
    } satisfies AssetRoleRepository;

    await moveAssetRoleUseCase(repository, 'asset-1', '  Fav\tFocus ');

    expect(moveRole).toHaveBeenCalledOnce();
    expect(moveRole).toHaveBeenCalledWith(
      createAssetId('asset-1'),
      createAssetRole('Fav Focus'),
    );
  });

  test('rejects invalid input before opening a repository operation', async () => {
    const moveRole = vi.fn<AssetRoleRepository['moveRole']>(() =>
      Promise.resolve(),
    );
    const repository = {
      moveRole,
      findByRole: () => Promise.resolve(null),
    } satisfies AssetRoleRepository;

    await expect(
      moveAssetRoleUseCase(repository, 'asset-1', ' '),
    ).rejects.toThrow('must not be empty');
    expect(moveRole).not.toHaveBeenCalled();
  });
});
