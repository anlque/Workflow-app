import { assetDatabaseSchemas } from '@/features/assets';
import { sessionDatabaseSchemas } from '@/features/session';
import { starterContentDatabaseSchemas } from '@/features/starter-content';
import { workflowDatabaseSchemas } from '@/features/workflow';
import { LocusoraDatabase, type DatabaseSchema } from '@/platform/storage';

export const productionDatabaseSchemas: readonly DatabaseSchema[] =
  Object.freeze([
    ...workflowDatabaseSchemas,
    ...sessionDatabaseSchemas,
    ...assetDatabaseSchemas,
    ...starterContentDatabaseSchemas,
  ]);

export function createProductionDatabase(name?: string): LocusoraDatabase {
  return new LocusoraDatabase({
    ...(name === undefined ? {} : { name }),
    schemas: productionDatabaseSchemas,
  });
}
