import type { Asset, AssetId } from '../domain/Asset';

export type AssetRepository = {
  list(): Promise<readonly Asset[]>;
  getBlob(id: AssetId): Promise<Blob | null>;
  save(asset: Asset, blob: Blob): Promise<void>;
  delete(id: AssetId): Promise<void>;
};
