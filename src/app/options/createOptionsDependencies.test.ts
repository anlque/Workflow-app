import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  runtime: {
    sendMessage: vi.fn(() => Promise.resolve()),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
  },
}));

vi.mock('wxt/browser', () => ({ browser: browserMock }));

import {
  assetDatabaseSchemas,
  createAsset,
  DexieAssetRepository,
} from '@/features/assets';
import { sessionDatabaseSchemas } from '@/features/session';
import {
  createWorkflow,
  DexieWorkflowRepository,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { LocusoraDatabase } from '@/platform/storage';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';

import { createOptionsDependencies } from './createOptionsDependencies';

const databaseNames: string[] = [];

afterEach(async () => {
  browserMock.runtime.sendMessage.mockClear();
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

function createDatabase(): LocusoraDatabase {
  const name = `options-role-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return new LocusoraDatabase({
    name,
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
}

async function seedAsset(
  assets: DexieAssetRepository,
  input: Parameters<typeof createAsset>[0],
) {
  const asset = createAsset(input);
  await assets.save(asset, new Blob(['x'], { type: asset.mimeType }));
  return asset;
}

describe('createOptionsDependencies Asset Role integration', () => {
  test('renames the Asset Role and every Workflow Role reference', async () => {
    const database = createDatabase();
    const assets = new DexieAssetRepository(database);
    const workflows = new DexieWorkflowRepository(database);
    const target = await seedAsset(assets, {
      id: 'forest',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
      role: 'Old scene',
    });
    await workflows.save(
      createWorkflow({
        id: 'workflow',
        name: 'Workflow',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: {
              backgroundAsset: { type: 'role', role: 'Old scene' },
            },
          },
        ],
      }),
    );
    const dependencies = createOptionsDependencies(
      createTestDocumentPreferences(),
      database,
    );

    const preview = await dependencies.inspectAssetRoleChange(
      target.id,
      'New scene',
    );
    await dependencies.applyAssetRoleChange(preview);
    const snapshot = await dependencies.load();

    expect(snapshot.assets[0]?.role).toBe('New scene');
    expect(
      snapshot.workflows[0]?.phases[0].environment.backgroundAsset,
    ).toEqual({ type: 'role', role: 'New scene' });
  });

  test('moves an occupied Role without rewriting Workflow Role strings', async () => {
    const database = createDatabase();
    const assets = new DexieAssetRepository(database);
    const workflows = new DexieWorkflowRepository(database);
    const owner = await seedAsset(assets, {
      id: 'forest',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
      role: 'Hero scene',
    });
    const target = await seedAsset(assets, {
      id: 'meadow',
      name: 'Meadow',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 2,
    });
    await workflows.save(
      createWorkflow({
        id: 'workflow',
        name: 'Workflow',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: {
              backgroundAsset: { type: 'role', role: 'Hero scene' },
            },
          },
        ],
      }),
    );
    const dependencies = createOptionsDependencies(
      createTestDocumentPreferences(),
      database,
    );

    const preview = await dependencies.inspectAssetRoleChange(
      target.id,
      'Hero scene',
    );
    expect(preview.action).toBe('move');
    expect(preview.currentOwner?.id).toBe(owner.id);
    await dependencies.applyAssetRoleChange(preview);
    const snapshot = await dependencies.load();

    expect(
      snapshot.assets.find(({ id }) => id === owner.id)?.role,
    ).toBeUndefined();
    expect(snapshot.assets.find(({ id }) => id === target.id)?.role).toBe(
      'Hero scene',
    );
    expect(
      snapshot.workflows[0]?.phases[0].environment.backgroundAsset,
    ).toEqual({ type: 'role', role: 'Hero scene' });
  });

  test('retries publication after a committed Role change without repeating storage writes', async () => {
    const database = createDatabase();
    const assets = new DexieAssetRepository(database);
    const target = await seedAsset(assets, {
      id: 'forest',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
    });
    const dependencies = createOptionsDependencies(
      createTestDocumentPreferences(),
      database,
    );
    const assetWrites = vi.spyOn(database.table('assets'), 'put');
    browserMock.runtime.sendMessage
      .mockRejectedValueOnce(new Error('Catalog publication failed.'))
      .mockResolvedValueOnce(undefined);

    const preview = await dependencies.inspectAssetRoleChange(
      target.id,
      'Hero',
    );
    await expect(dependencies.applyAssetRoleChange(preview)).rejects.toThrow(
      'Catalog publication failed.',
    );
    expect((await assets.get(target.id))?.role).toBe('Hero');
    const committed = await dependencies.inspectAssetRoleChange(
      target.id,
      'Hero',
    );
    expect(committed.action).toBe('unchanged');
    await dependencies.synchronizeAssetRoleChange();

    expect(assetWrites).toHaveBeenCalledOnce();
    expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('createOptionsDependencies Asset retirement integration', () => {
  test('atomically replaces direct references, transfers Role and deletes source', async () => {
    const database = createDatabase();
    const assets = new DexieAssetRepository(database);
    const workflows = new DexieWorkflowRepository(database);
    const source = await seedAsset(assets, {
      id: 'source',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
      role: 'Hero',
    });
    const replacement = await seedAsset(assets, {
      id: 'replacement',
      name: 'Meadow',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 2,
    });
    await workflows.save(
      createWorkflow({
        id: 'retirement-workflow',
        name: 'Retirement',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: {
              backgroundAsset: { type: 'direct', assetId: source.id },
            },
          },
        ],
      }),
    );
    const dependencies = createOptionsDependencies(
      createTestDocumentPreferences(),
      database,
    );

    const preview = await dependencies.inspectAssetRetirement(source.id);
    await dependencies.retireAsset(preview, {
      type: 'existing',
      assetId: replacement.id,
    });
    const snapshot = await dependencies.load();

    expect(snapshot.assets.find(({ id }) => id === source.id)).toBeUndefined();
    expect(snapshot.assets.find(({ id }) => id === replacement.id)?.role).toBe(
      'Hero',
    );
    expect(
      snapshot.workflows[0]?.phases[0].environment.backgroundAsset,
    ).toEqual({
      type: 'direct',
      assetId: replacement.id,
    });
  });

  test('does not repeat committed retirement when catalog publication is retried', async () => {
    const database = createDatabase();
    const assets = new DexieAssetRepository(database);
    const source = await seedAsset(assets, {
      id: 'source-publish',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
    });
    const dependencies = createOptionsDependencies(
      createTestDocumentPreferences(),
      database,
    );
    const assetDeletes = vi.spyOn(database.table('assets'), 'delete');
    browserMock.runtime.sendMessage
      .mockRejectedValueOnce(new Error('Catalog publication failed.'))
      .mockResolvedValueOnce(undefined);

    const preview = await dependencies.inspectAssetRetirement(source.id);
    await dependencies.retireAsset(preview, { type: 'remove' });
    await expect(dependencies.synchronizeAssetRetirement()).rejects.toThrow(
      'Catalog publication failed.',
    );
    await dependencies.synchronizeAssetRetirement();

    expect(assetDeletes).toHaveBeenCalledOnce();
    expect(await assets.get(source.id)).toBeNull();
    expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });
});
