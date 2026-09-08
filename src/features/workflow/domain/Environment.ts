import type { AssetId } from '@/shared';
import type { AssetRole } from '@/features/assets';

export type { AssetId } from '@/shared';

export type AssetReference =
  | Readonly<{ type: 'direct'; assetId: AssetId }>
  | Readonly<{ type: 'role'; role: AssetRole }>;

export type AssetReferenceInput =
  | Readonly<{ type: 'direct'; assetId: string }>
  | Readonly<{ type: 'role'; role: string }>;

export type Environment = Readonly<{
  backgroundAsset?: AssetReference;
  audioAsset?: AssetReference;
  backgroundColor?: string;
}>;

export type EnvironmentInput = Readonly<{
  backgroundAsset?: AssetReferenceInput;
  audioAsset?: AssetReferenceInput;
  /** Legacy direct input accepted while direct-only UI callers migrate. */
  backgroundAssetId?: string;
  /** Legacy direct input accepted while direct-only UI callers migrate. */
  audioAssetId?: string;
  backgroundColor?: string;
}>;
