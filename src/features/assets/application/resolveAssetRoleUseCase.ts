import type { AssetId, AssetKind, AssetRole } from '../domain/Asset';
import type { AssetRoleRepository } from './AssetRoleRepository';

export class UnresolvedAssetRoleError extends Error {
  public constructor(role: AssetRole) {
    super(`Asset Role "${role}" is not assigned.`);
    this.name = 'UnresolvedAssetRoleError';
  }
}

export class WrongKindAssetRoleError extends Error {
  public constructor(role: AssetRole, expectedKind: AssetKind) {
    super(`Asset Role "${role}" must reference an ${expectedKind} Asset.`);
    this.name = 'WrongKindAssetRoleError';
  }
}

export async function resolveAssetRoleUseCase(
  repository: AssetRoleRepository,
  role: AssetRole,
  expectedKind: AssetKind,
): Promise<AssetId> {
  const asset = await repository.findByRole(role);
  if (asset === null) throw new UnresolvedAssetRoleError(role);
  if (asset.kind !== expectedKind) {
    throw new WrongKindAssetRoleError(role, expectedKind);
  }
  return asset.id;
}
