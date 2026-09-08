import type { DatabaseSchema } from '@/platform/storage';

type AssetRecordBase = Readonly<{
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  byteSize: number;
  createdAt: number;
  blob: Blob;
}>;

export type AssetRecordV1 = AssetRecordBase & Readonly<{ schemaVersion: 1 }>;

export type AssetRecordV2 = AssetRecordBase &
  Readonly<{
    schemaVersion: 2;
    role?: string;
    roleKey?: string;
  }>;

export type AssetRecord = AssetRecordV1 | AssetRecordV2;

export const assetDatabaseSchemas: readonly DatabaseSchema[] = [
  {
    version: 3,
    stores: {
      assets: 'id, createdAt',
    },
  },
  {
    version: 4,
    stores: {
      assets: 'id, createdAt, &roleKey',
    },
  },
];
