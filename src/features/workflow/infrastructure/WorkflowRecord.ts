import type { DatabaseSchema } from '@/platform/storage';

type StoredAssetReference =
  | Readonly<{ type: 'direct'; assetId: string }>
  | Readonly<{ type: 'role'; role: string }>;

type WorkflowRecordBase = Readonly<{
  id: string;
  order: number;
  name: string;
  phases: readonly Readonly<{
    type: string;
    durationSeconds: number;
    environment: Readonly<Record<string, unknown>>;
  }>[];
  rewardDice?: unknown;
}>;

export type WorkflowRecordV1 = WorkflowRecordBase &
  Readonly<{ schemaVersion: 1 }>;

export type WorkflowRecordV2 = WorkflowRecordBase &
  Readonly<{
    schemaVersion: 2;
    phases: readonly Readonly<{
      type: string;
      durationSeconds: number;
      environment: Readonly<{
        backgroundAsset?: StoredAssetReference;
        audioAsset?: StoredAssetReference;
        backgroundColor?: string;
      }>;
    }>[];
  }>;

export type WorkflowRecordV3 = WorkflowRecordBase &
  Readonly<{
    schemaVersion: 3;
    phases: WorkflowRecordV2['phases'];
  }>;

export type WorkflowRecord =
  WorkflowRecordV1 | WorkflowRecordV2 | WorkflowRecordV3;

export const workflowDatabaseSchemas: readonly DatabaseSchema[] = [
  {
    version: 1,
    stores: {
      workflows: 'id, order',
    },
  },
];
