import type { AssetId } from '../domain/Asset';

export type WorkflowAssetReferences = {
  count(assetId: AssetId): Promise<number>;
};
