import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test } from 'vitest';

import {
  createProductionDatabase,
  productionDatabaseSchemas,
} from './databaseSchemas';

const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe('productionDatabaseSchemas', () => {
  test('compose the complete global version 1 through 5 history', async () => {
    expect(productionDatabaseSchemas.map(({ version }) => version)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    const name = `production-schema-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const database = createProductionDatabase(name);
    await database.open();

    expect(database.verno).toBe(5);
    expect(
      database.tables.map(({ name: tableName }) => tableName).sort(),
    ).toEqual(['assets', 'sessions', 'starterContentSeeds', 'workflows']);
    database.close();
  });
});
