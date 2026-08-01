import type { AssetId } from '@/shared';

export type { AssetId } from '@/shared';

export type Environment = Readonly<{
  backgroundAssetId?: AssetId;
  audioAssetId?: AssetId;
  backgroundColor?: string;
}>;

export type EnvironmentInput = Readonly<{
  backgroundAssetId?: string;
  audioAssetId?: string;
  backgroundColor?: string;
}>;
