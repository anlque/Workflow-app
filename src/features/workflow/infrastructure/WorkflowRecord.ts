import type { DatabaseSchema } from '@/platform/storage';

export type WorkflowRecord = Readonly<{
  id: string;
  schemaVersion: 1;
  order: number;
  name: string;
  phases: readonly Readonly<{
    type: string;
    durationSeconds: number;
    environment: Readonly<{
      backgroundAssetId?: string;
      audioAssetId?: string;
      backgroundColor?: string;
    }>;
  }>[];
  rewardDice?: Readonly<{
    frequency: number;
    sides: readonly Readonly<{
      icon: string;
      title: string;
      description?: string;
      probability: number;
    }>[];
  }>;
}>;

export const workflowDatabaseSchemas: readonly DatabaseSchema[] = [
  {
    version: 1,
    stores: {
      workflows: 'id, order',
    },
  },
];
