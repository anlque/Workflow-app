import type { Table } from 'dexie';

import type { LocusoraDatabase } from '@/platform/storage';

import type { AssetRepository } from '../application/AssetRepository';
import { createAsset, type Asset, type AssetId } from '../domain/Asset';
import { AssetStorageError, AssetValidationError } from '../domain/AssetErrors';
import type { AssetRecord } from './AssetRecord';

function mapRecord(value: unknown): Readonly<{ asset: Asset; blob: Blob }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AssetValidationError('Stored Asset record is invalid.');
  }
  const record = value as Readonly<Record<string, unknown>>;
  const blob = record['blob'];
  if (
    record['schemaVersion'] !== 1 ||
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
  const asset = createAsset({
    id: record['id'],
    name: record['name'],
    kind: record['kind'],
    mimeType: record['mimeType'],
    byteSize: record['byteSize'],
    createdAt: record['createdAt'],
  });
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
  return { ...asset, schemaVersion: 1, blob };
}

export class DexieAssetRepository implements AssetRepository {
  readonly #assets: Table<AssetRecord, string>;

  public constructor(database: LocusoraDatabase) {
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
      throw error;
    }
  }

  public async delete(id: AssetId): Promise<void> {
    await this.#assets.delete(id);
  }
}
