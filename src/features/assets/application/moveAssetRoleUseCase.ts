import { createAssetId, createAssetRole } from '../domain/Asset';
import type { AssetRoleRepository } from './AssetRoleRepository';

export async function moveAssetRoleUseCase(
  repository: AssetRoleRepository,
  targetAssetId: string,
  role: string,
): Promise<void> {
  await repository.moveRole(
    createAssetId(targetAssetId),
    createAssetRole(role),
  );
}
