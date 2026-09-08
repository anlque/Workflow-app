import type { AssetId } from '@/shared';

import { AssetValidationError } from './AssetErrors';

export type { AssetId } from '@/shared';
export type AssetKind = 'image' | 'audio';

declare const assetRoleBrand: unique symbol;
export type AssetRole = string & { readonly [assetRoleBrand]: 'AssetRole' };

const MAX_ASSET_ROLE_CODE_POINTS = 64;

export function createAssetRole(value: string): AssetRole {
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (normalized.length === 0) {
    throw new AssetValidationError('Asset Role must not be empty.');
  }
  if (Array.from(normalized).length > MAX_ASSET_ROLE_CODE_POINTS) {
    throw new AssetValidationError(
      'Asset Role must not exceed 64 Unicode code points.',
    );
  }
  return normalized as AssetRole;
}

export function assetRoleKey(role: AssetRole): string {
  return role.toLowerCase().normalize('NFKC');
}

export type Asset = Readonly<{
  id: AssetId;
  name: string;
  kind: AssetKind;
  mimeType: string;
  byteSize: number;
  createdAt: number;
  role?: AssetRole;
}>;

export type CreateAssetInput = Readonly<{
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  byteSize: number;
  createdAt: number;
  role?: string;
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
    ...(input.role === undefined ? {} : { role: createAssetRole(input.role) }),
  });
}
