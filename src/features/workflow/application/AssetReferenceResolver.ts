import type { AssetId, AssetKind, AssetRole } from '@/features/assets';

export type AssetReferenceResolver = {
  resolve(role: AssetRole, expectedKind: AssetKind): Promise<AssetId>;
};
