declare const assetIdBrand: unique symbol;

export type AssetId = string & { readonly [assetIdBrand]: 'AssetId' };
