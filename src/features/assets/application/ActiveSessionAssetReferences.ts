import type { AssetId } from '../domain/Asset';

export type ActiveSessionAssetReferences = {
  has(assetId: AssetId): Promise<boolean>;
};
