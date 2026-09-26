import type { DatabaseSchema } from '@/platform/storage';

export type SessionRecord = Readonly<{
  id: string;
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  active: 0 | 1;
  updatedAt: number;
  session: unknown;
}>;

export const sessionDatabaseSchemas: readonly DatabaseSchema[] = [
  {
    version: 2,
    stores: {
      sessions: 'id, active, updatedAt',
    },
  },
];
