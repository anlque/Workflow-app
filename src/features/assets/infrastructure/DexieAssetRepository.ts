import type { Table } from 'dexie';

import type { LocusoraDatabase } from '@/platform/storage';

import type { AssetRepository } from '../application/AssetRepository';
import {
  assetRoleKey,
  createAsset,
  type Asset,
  type AssetId,
  type AssetRole,
} from '../domain/Asset';
import {
  AssetRoleConflictError,
  AssetStorageError,
  AssetValidationError,
} from '../domain/AssetErrors';
import type { AssetRecord } from './AssetRecord';

function mapRecord(value: unknown): Readonly<{ asset: Asset; blob: Blob }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AssetValidationError('Stored Asset record is invalid.');
  }
  const record = value as Readonly<Record<string, unknown>>;
  const blob = record['blob'];
  if (
    (record['schemaVersion'] !== 1 && record['schemaVersion'] !== 2) ||
    typeof record['id'] !== 'string' ||
    typeof record['name'] !== 'string' ||
    (record['kind'] !== 'image' && record['kind'] !== 'audio') ||
    typeof record['mimeType'] !== 'string' ||
    typeof record['byteSize'] !== 'number' ||
    typeof record['createdAt'] !== 'number' ||
    !(blob instanceof Blob)
  ) {
    throw new AssetValidationError('Stored Asset record is invalid.');
  }
  const role = record['role'];
  const roleKey = record['roleKey'];
  if (
    record['schemaVersion'] === 1 &&
    (role !== undefined || roleKey !== undefined)
  ) {
    throw new AssetValidationError('Stored Asset record is invalid.');
  }
  if (
    record['schemaVersion'] === 2 &&
    ((role === undefined) !== (roleKey === undefined) ||
      (role !== undefined && typeof role !== 'string') ||
      (roleKey !== undefined && typeof roleKey !== 'string'))
  ) {
    throw new AssetValidationError('Stored Asset record is invalid.');
  }
  const asset = createAsset({
    id: record['id'],
    name: record['name'],
    kind: record['kind'],
    mimeType: record['mimeType'],
    byteSize: record['byteSize'],
    createdAt: record['createdAt'],
    ...(typeof role === 'string' ? { role } : {}),
  });
  if (asset.role !== undefined && roleKey !== assetRoleKey(asset.role)) {
    throw new AssetValidationError('Stored Asset Role key is invalid.');
  }
  if (blob.size !== asset.byteSize || blob.type !== asset.mimeType) {
    throw new AssetValidationError(
      'Stored Asset Blob metadata does not match.',
    );
  }
  return { asset, blob };
}

function toRecord(asset: Asset, blob: Blob): AssetRecord {
  if (blob.size !== asset.byteSize || blob.type !== asset.mimeType) {
    throw new AssetValidationError('Asset Blob metadata does not match.');
  }
  return {
    ...asset,
    schemaVersion: 2,
    ...(asset.role === undefined ? {} : { roleKey: assetRoleKey(asset.role) }),
    blob,
  };
}

export class DexieAssetRepository implements AssetRepository {
  readonly #database: LocusoraDatabase;
  readonly #assets: Table<AssetRecord, string>;

  public constructor(database: LocusoraDatabase) {
    this.#database = database;
    this.#assets = database.table<AssetRecord, string>('assets');
  }

  public async list(): Promise<readonly Asset[]> {
    const values: unknown[] = await this.#assets.toArray();
    return values
      .map((value) => mapRecord(value).asset)
      .sort((left, right) => left.createdAt - right.createdAt);
  }

  public async getBlob(id: AssetId): Promise<Blob | null> {
    const value: unknown = await this.#assets.get(id);
    return value === undefined ? null : mapRecord(value).blob;
  }

  public async findByRole(role: AssetRole): Promise<Asset | null> {
    const value: unknown = await this.#assets
      .where('roleKey')
      .equals(assetRoleKey(role))
      .first();
    return value === undefined ? null : mapRecord(value).asset;
  }

  public async moveRole(targetId: AssetId, role: AssetRole): Promise<void> {
    await this.#database.runReadWrite('assets', async () => {
      const targetValue: unknown = await this.#assets.get(targetId);
      if (targetValue === undefined) {
        throw new AssetValidationError('Target Asset was not found.');
      }
      const target = mapRecord(targetValue);
      if (
        target.asset.role !== undefined &&
        assetRoleKey(target.asset.role) !== assetRoleKey(role)
      ) {
        throw new AssetRoleConflictError();
      }
      const sourceValue: unknown = await this.#assets
        .where('roleKey')
        .equals(assetRoleKey(role))
        .first();
      const source =
        sourceValue === undefined ? undefined : mapRecord(sourceValue);
      if (source?.asset.id === targetId) return;

      if (source !== undefined) {
        await this.#assets.put(
          toRecord(
            createAsset({
              id: source.asset.id,
              name: source.asset.name,
              kind: source.asset.kind,
              mimeType: source.asset.mimeType,
              byteSize: source.asset.byteSize,
              createdAt: source.asset.createdAt,
            }),
            source.blob,
          ),
        );
      }
      await this.#assets.put(
        toRecord(createAsset({ ...target.asset, role }), target.blob),
      );
    });
  }

  public async save(asset: Asset, blob: Blob): Promise<void> {
    try {
      await this.#assets.put(toRecord(asset, blob));
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        throw new AssetStorageError('Browser storage quota was exceeded.', {
          cause: error,
        });
      }
      if (error instanceof Error && error.name === 'ConstraintError') {
        throw new AssetRoleConflictError();
      }
      throw error;
    }
  }

  public async delete(id: AssetId): Promise<void> {
    await this.#assets.delete(id);
  }
}
