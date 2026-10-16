import type { DatabaseSchema } from '@/platform/storage';

export type StarterContentSeedRecord = Readonly<{
  version: number;
  completedAt: number;
}>;

export const starterContentDatabaseSchemas: readonly DatabaseSchema[] = [
  {
    version: 5,
    stores: {
      starterContentSeeds: 'version, completedAt',
    },
  },
];
