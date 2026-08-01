import type { DatabaseSchema } from '@/platform/storage';

export type AssetRecord = Readonly<{
  id: string;
  schemaVersion: 1;
  name: string;
  kind: string;
  mimeType: string;
  byteSize: number;
  createdAt: number;
  blob: Blob;
}>;

export const assetDatabaseSchemas: readonly DatabaseSchema[] = [
  {
    version: 3,
    stores: {
      assets: 'id, createdAt',
    },
  },
];
