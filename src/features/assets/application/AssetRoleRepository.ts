import type { Asset, AssetId, AssetRole } from '../domain/Asset';

export type AssetRoleRepository = {
  findByRole(role: AssetRole): Promise<Asset | null>;
  moveRole(targetId: AssetId, role: AssetRole): Promise<void>;
};
