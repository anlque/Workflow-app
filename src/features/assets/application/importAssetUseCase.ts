import { createAsset, type Asset, type AssetKind } from '../domain/Asset';
import { AssetValidationError } from '../domain/AssetErrors';
import type { AssetRepository } from './AssetRepository';

export type AssetKindImportPolicy = Readonly<{
  maxBytes: number;
  mimeTypes: readonly string[];
}>;

export type AssetImportPolicy = Readonly<
  Record<AssetKind, AssetKindImportPolicy>
>;

export type ImportAssetInput = Readonly<{
  id: string;
  name: string;
  kind: AssetKind;
  blob: Blob;
  createdAt: number;
}>;

export function validateAssetImport(
  policy: AssetImportPolicy,
  input: ImportAssetInput,
): Asset {
  const kindPolicy = policy[input.kind];
  if (!Number.isSafeInteger(kindPolicy.maxBytes) || kindPolicy.maxBytes <= 0) {
    throw new AssetValidationError('Asset size policy is invalid.');
  }
  if (input.blob.size === 0) {
    throw new AssetValidationError('Asset content must not be empty.');
  }
  if (!kindPolicy.mimeTypes.includes(input.blob.type)) {
    throw new AssetValidationError(
      `Asset MIME type ${input.blob.type || '(empty)'} is not supported for ${input.kind}.`,
    );
  }
  if (input.blob.size > kindPolicy.maxBytes) {
    throw new AssetValidationError('Asset exceeds the configured size limit.');
  }

  return createAsset({
    id: input.id,
    name: input.name,
    kind: input.kind,
    mimeType: input.blob.type,
    byteSize: input.blob.size,
    createdAt: input.createdAt,
  });
}

export async function importAssetUseCase(
  repository: AssetRepository,
  policy: AssetImportPolicy,
  input: ImportAssetInput,
): Promise<Asset> {
  const asset = validateAssetImport(policy, input);
  await repository.save(asset, input.blob);
  return asset;
}
