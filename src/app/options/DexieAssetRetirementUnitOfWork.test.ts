import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  assetDatabaseSchemas,
  createAsset,
  DexieAssetRepository,
  inspectAssetRetirementUseCase,
  retireAssetUseCase,
} from '@/features/assets';
import { sessionDatabaseSchemas } from '@/features/session';
import {
  createWorkflow,
  DexieWorkflowRepository,
  removeOptionalWorkflowAssetReferences,
  replaceWorkflowAssetReferences,
  summarizeWorkflowAssetReferences,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { LocusoraDatabase } from '@/platform/storage';

import { DexieAssetRetirementUnitOfWork } from './DexieAssetRetirementUnitOfWork';

const names: string[] = [];
afterEach(async () =>
  Promise.all(names.splice(0).map((name) => Dexie.delete(name))),
);

async function setup() {
  const name = `asset-retirement-${crypto.randomUUID()}`;
  names.push(name);
  const database = new LocusoraDatabase({
    name,
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
  const assets = new DexieAssetRepository(database);
  const workflows = new DexieWorkflowRepository(database);
  const blob = new Blob(['x'], { type: 'image/png' });
  const source = createAsset({
    id: 'source',
    name: 'Source',
    kind: 'image',
    mimeType: blob.type,
    byteSize: blob.size,
    createdAt: 1,
    role: 'Hero',
  });
  const replacement = createAsset({
    id: 'replacement',
    name: 'Replacement',
    kind: 'image',
    mimeType: blob.type,
    byteSize: blob.size,
    createdAt: 2,
  });
  await assets.save(source, blob);
  await assets.save(replacement, blob);
  await workflows.save(
    createWorkflow({
      id: 'workflow',
      name: 'Workflow',
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
  const active = { has: () => Promise.resolve(false) };
  const workflowReferences = {
    summarize: summarizeWorkflowAssetReferences.bind(null, workflows),
    replace: replaceWorkflowAssetReferences.bind(null, workflows),
    removeOptional: removeOptionalWorkflowAssetReferences.bind(null, workflows),
  };
  const preview = await inspectAssetRetirementUseCase(
    assets,
    active,
    workflowReferences,
    source.id,
  );
  const run = (choice: Parameters<typeof retireAssetUseCase>[6]) =>
    retireAssetUseCase(
      assets,
      active,
      workflowReferences,
      new DexieAssetRetirementUnitOfWork(database),
      {
        image: { maxBytes: 10, mimeTypes: ['image/png'] },
        audio: { maxBytes: 10, mimeTypes: ['audio/mpeg'] },
      },
      preview,
      choice,
    );
  const expectUnchanged = async () => {
    expect((await assets.get(source.id))?.role).toBe('Hero');
    expect((await assets.get(replacement.id))?.role).toBeUndefined();
    expect(
      (await workflows.list())[0]?.phases[0].environment.backgroundAsset,
    ).toEqual({ type: 'direct', assetId: source.id });
  };
  return { database, assets, source, replacement, run, expectUnchanged };
}

describe('DexieAssetRetirementUnitOfWork', () => {
  test('rolls back a failed uploaded-Asset write', async () => {
    const value = await setup();
    vi.spyOn(value.database.table('assets'), 'put').mockRejectedValueOnce(
      new Error('upload failed'),
    );
    await expect(
      value.run({
        type: 'upload',
        input: {
          id: 'uploaded',
          name: 'Uploaded',
          kind: 'image',
          blob: new Blob(['y'], { type: 'image/png' }),
          createdAt: 3,
        },
      }),
    ).rejects.toThrow('upload failed');
    await value.expectUnchanged();
    expect(
      await value.assets.get(
        createAsset({
          id: 'uploaded',
          name: 'Uploaded',
          kind: 'image',
          mimeType: 'image/png',
          byteSize: 1,
          createdAt: 3,
        }).id,
      ),
    ).toBeNull();
  });

  test('rolls back the upload when a Workflow write fails', async () => {
    const value = await setup();
    vi.spyOn(value.database.table('workflows'), 'put').mockRejectedValueOnce(
      new Error('workflow failed'),
    );
    await expect(
      value.run({
        type: 'upload',
        input: {
          id: 'uploaded',
          name: 'Uploaded',
          kind: 'image',
          blob: new Blob(['y'], { type: 'image/png' }),
          createdAt: 3,
        },
      }),
    ).rejects.toThrow('workflow failed');
    await value.expectUnchanged();
    expect((await value.assets.list()).map(({ id }) => id)).not.toContain(
      'uploaded',
    );
  });

  test('rolls back Workflow changes when Role transfer fails', async () => {
    const value = await setup();
    vi.spyOn(value.database.table('assets'), 'put').mockRejectedValueOnce(
      new Error('role failed'),
    );
    await expect(
      value.run({ type: 'existing', assetId: value.replacement.id }),
    ).rejects.toThrow('role failed');
    await value.expectUnchanged();
  });

  test('rolls back Workflow and Role changes when deletion fails', async () => {
    const value = await setup();
    vi.spyOn(value.database.table('assets'), 'delete').mockRejectedValueOnce(
      new Error('delete failed'),
    );
    await expect(
      value.run({ type: 'existing', assetId: value.replacement.id }),
    ).rejects.toThrow('delete failed');
    await value.expectUnchanged();
  });
});
