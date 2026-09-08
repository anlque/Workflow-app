import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  assetDatabaseSchemas,
  AssetRoleConflictError,
  createAsset,
} from '@/features/assets';
import {
  createWorkflow,
  DexieWorkflowRepository,
  renameWorkflowRoleReferences,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { LocusoraDatabase } from '@/platform/storage';

import { DexieAssetRoleManagementUnitOfWork } from './DexieAssetRoleManagementUnitOfWork';
import { DexieAssetRepository } from '@/features/assets';
import { createAssetRole } from '@/features/assets';

const names: string[] = [];
afterEach(async () =>
  Promise.all(names.splice(0).map((name) => Dexie.delete(name))),
);

describe('DexieAssetRoleManagementUnitOfWork', () => {
  test('commits Workflow and Asset Role rename together', async () => {
    const name = `role-uow-${crypto.randomUUID()}`;
    names.push(name);
    const database = new LocusoraDatabase({
      name,
      schemas: [...workflowDatabaseSchemas, ...assetDatabaseSchemas],
    });
    const workflows = new DexieWorkflowRepository(database);
    const assets = new DexieAssetRepository(database);
    const unitOfWork = new DexieAssetRoleManagementUnitOfWork(database);
    const blob = new Blob(['x'], { type: 'image/png' });
    const target = createAsset({
      id: 'asset',
      name: 'Asset',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Old',
    });
    await assets.save(target, blob);
    await workflows.save(
      createWorkflow({
        id: 'workflow',
        name: 'Workflow',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: { backgroundAsset: { type: 'role', role: 'Old' } },
          },
        ],
      }),
    );
    await unitOfWork.run(async () => {
      await renameWorkflowRoleReferences(
        workflows,
        createAssetRole('Old'),
        createAssetRole('New'),
      );
      await assets.renameRole(
        target.id,
        createAssetRole('Old'),
        createAssetRole('New'),
      );
    });
    expect((await assets.get(target.id))?.role).toBe('New');
    expect(
      (await workflows.list())[0]?.phases[0].environment.backgroundAsset,
    ).toEqual({ type: 'role', role: 'New' });
  });

  test('rolls Workflow rename back when the Asset write fails', async () => {
    const name = `role-uow-${crypto.randomUUID()}`;
    names.push(name);
    const database = new LocusoraDatabase({
      name,
      schemas: [...workflowDatabaseSchemas, ...assetDatabaseSchemas],
    });
    const workflows = new DexieWorkflowRepository(database);
    const assets = new DexieAssetRepository(database);
    const unitOfWork = new DexieAssetRoleManagementUnitOfWork(database);
    const blob = new Blob(['x'], { type: 'image/png' });
    const target = createAsset({
      id: 'asset',
      name: 'Asset',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'Old',
    });
    await assets.save(target, blob);
    await workflows.save(
      createWorkflow({
        id: 'workflow',
        name: 'Workflow',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: { backgroundAsset: { type: 'role', role: 'Old' } },
          },
        ],
      }),
    );
    vi.spyOn(database.table('assets'), 'put').mockRejectedValueOnce(
      new Error('Asset write failed'),
    );
    await expect(
      unitOfWork.run(async () => {
        await renameWorkflowRoleReferences(
          workflows,
          createAssetRole('Old'),
          createAssetRole('New'),
        );
        await assets.renameRole(
          target.id,
          createAssetRole('Old'),
          createAssetRole('New'),
        );
      }),
    ).rejects.toThrow('Asset write failed');
    expect((await assets.get(target.id))?.role).toBe('Old');
    expect(
      (await workflows.list())[0]?.phases[0].environment.backgroundAsset,
    ).toEqual({ type: 'role', role: 'Old' });
  });

  test('preserves uniqueness across concurrent repository renames', async () => {
    const name = `role-uow-concurrent-${crypto.randomUUID()}`;
    names.push(name);
    const firstDatabase = new LocusoraDatabase({
      name,
      schemas: [...workflowDatabaseSchemas, ...assetDatabaseSchemas],
    });
    const secondDatabase = new LocusoraDatabase({
      name,
      schemas: [...workflowDatabaseSchemas, ...assetDatabaseSchemas],
    });
    const first = new DexieAssetRepository(firstDatabase);
    const second = new DexieAssetRepository(secondDatabase);
    const blob = new Blob(['x'], { type: 'image/png' });
    const one = createAsset({
      id: 'one',
      name: 'One',
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1,
      role: 'One',
    });
    const two = createAsset({
      ...one,
      id: 'two',
      name: 'Two',
      createdAt: 2,
      role: 'Two',
    });
    await first.save(one, blob);
    await first.save(two, blob);
    const results = await Promise.allSettled([
      new DexieAssetRoleManagementUnitOfWork(firstDatabase).run(() =>
        first.renameRole(
          one.id,
          createAssetRole('One'),
          createAssetRole('Shared'),
        ),
      ),
      new DexieAssetRoleManagementUnitOfWork(secondDatabase).run(() =>
        second.renameRole(
          two.id,
          createAssetRole('Two'),
          createAssetRole('Shared'),
        ),
      ),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    const rejection = results.find(({ status }) => status === 'rejected');
    expect(rejection?.status).toBe('rejected');
    if (rejection?.status !== 'rejected') throw new Error('Expected conflict.');
    expect(rejection.reason).toBeInstanceOf(AssetRoleConflictError);
    expect(
      (await first.list()).filter(({ role }) => role === 'Shared'),
    ).toHaveLength(1);
  });
});
