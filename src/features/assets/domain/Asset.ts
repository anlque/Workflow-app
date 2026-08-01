import type { AssetId } from '@/shared';

import { AssetValidationError } from './AssetErrors';

export type { AssetId } from '@/shared';
export type AssetKind = 'image' | 'audio';

export type Asset = Readonly<{
  id: AssetId;
  name: string;
  kind: AssetKind;
  mimeType: string;
  byteSize: number;
  createdAt: number;
}>;

export type CreateAssetInput = Readonly<{
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  byteSize: number;
  createdAt: number;
}>;

export function createAssetId(value: string): AssetId {
  if (value.trim().length === 0) {
    throw new AssetValidationError('Asset identifier must not be empty.');
  }
  return value as AssetId;
}

export function createAsset(input: CreateAssetInput): Asset {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new AssetValidationError('Asset name must not be empty.');
  }
  if (input.kind !== 'image' && input.kind !== 'audio') {
    throw new AssetValidationError('Asset kind must be image or audio.');
  }
  if (input.mimeType.trim().length === 0) {
    throw new AssetValidationError('Asset MIME type must not be empty.');
  }
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0) {
    throw new AssetValidationError(
      'Asset byte size must be a positive integer.',
    );
  }
  if (!Number.isFinite(input.createdAt) || input.createdAt < 0) {
    throw new AssetValidationError('Asset creation time is invalid.');
  }

  return Object.freeze({
    id: createAssetId(input.id),
    name,
    kind: input.kind,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    createdAt: input.createdAt,
  });
}
