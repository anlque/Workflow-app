declare const assetIdBrand: unique symbol;

export type AssetId = string & { readonly [assetIdBrand]: 'AssetId' };

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
