import { describe, expect, test, vi } from 'vitest';

import { createAsset, createAssetRole, type Asset } from '../domain/Asset';
import { StaleAssetRoleChangeError } from '../domain/AssetErrors';
import type { AssetRoleManagementRepository } from './AssetRoleChange';
import {
  applyAssetRoleChangeUseCase,
  inspectAssetRoleChangeUseCase,
} from './assetRoleChangeUseCases';

function asset(
  id: string,
  role?: string,
  kind: 'image' | 'audio' = 'image',
): Asset {
  return createAsset({
    id,
    name: id,
    kind,
    mimeType: kind === 'image' ? 'image/png' : 'audio/mpeg',
    byteSize: 1,
    createdAt: 1,
    ...(role === undefined ? {} : { role }),
  });
}

function setup(initial: readonly Asset[]) {
  const assets = new Map(initial.map((value) => [value.id, value]));
  const moveRole = vi.fn(() => Promise.resolve());
  const renameRole = vi.fn(() => Promise.resolve());
  const repository: AssetRoleManagementRepository = {
    get: (id) => Promise.resolve(assets.get(id) ?? null),
    findByRole: (role) =>
      Promise.resolve(
        [...assets.values()].find(
          (value) => value.role?.toLowerCase() === role.toLowerCase(),
        ) ?? null,
      ),
    moveRole,
    renameRole,
  };
  const renameReferences = vi.fn(() => Promise.resolve());
  const usage = {
    summarize: vi.fn(() =>
      Promise.resolve({
        workflowCount: 2,
        expectedKinds: ['image' as const, 'audio' as const],
      }),
    ),
    renameReferences,
  };
  const unitOfWork = { run: <T>(operation: () => Promise<T>) => operation() };
  return {
    assets,
    repository,
    usage,
    unitOfWork,
    moveRole,
    renameRole,
    renameReferences,
  };
}

describe('Asset Role change use cases', () => {
  test('rejects invalid input before repository reads or writes', async () => {
    const deps = setup([asset('target')]);
    const get = vi.spyOn(deps.repository, 'get');
    await expect(
      inspectAssetRoleChangeUseCase(
        deps.repository,
        deps.usage,
        asset('target').id,
        ' ',
      ),
    ).rejects.toThrow('must not be empty');
    expect(get).not.toHaveBeenCalled();
    expect(deps.moveRole).not.toHaveBeenCalled();
    expect(deps.renameRole).not.toHaveBeenCalled();
  });

  test('rejects a missing target without writes', async () => {
    const deps = setup([]);
    await expect(
      inspectAssetRoleChangeUseCase(
        deps.repository,
        deps.usage,
        asset('missing').id,
        'Hero',
      ),
    ).rejects.toThrow('Target Asset was not found.');
    expect(deps.moveRole).not.toHaveBeenCalled();
    expect(deps.renameRole).not.toHaveBeenCalled();
  });
  test.each([
    { initial: [asset('target')], value: 'Hero', action: 'create' },
    { initial: [asset('target', 'Old')], value: 'New', action: 'rename' },
    {
      initial: [asset('target'), asset('owner', 'Hero')],
      value: 'hero',
      action: 'move',
    },
    { initial: [asset('target', 'Hero')], value: 'Hero', action: 'unchanged' },
  ] as const)(
    'inspects $action without mutation',
    async ({ initial, value, action }) => {
      const setupValue = setup(initial);
      const preview = await inspectAssetRoleChangeUseCase(
        setupValue.repository,
        setupValue.usage,
        initial[0].id,
        value,
      );
      expect(preview).toMatchObject({
        action,
        role: createAssetRole(value),
        affectedWorkflowCount:
          action === 'rename' ? 2 : action === 'move' ? 2 : 0,
      });
      expect(setupValue.moveRole).not.toHaveBeenCalled();
      expect(setupValue.renameRole).not.toHaveBeenCalled();
    },
  );

  test('rejects assigning an occupied Role to an Asset that already owns another Role', async () => {
    const deps = setup([asset('target', 'Other'), asset('owner', 'Hero')]);
    await expect(
      inspectAssetRoleChangeUseCase(
        deps.repository,
        deps.usage,
        asset('target').id,
        'Hero',
      ),
    ).rejects.toThrow('Choose another Asset or enter an available Role name.');
    expect(deps.moveRole).not.toHaveBeenCalled();
    expect(deps.renameRole).not.toHaveBeenCalled();
    expect(deps.renameReferences).not.toHaveBeenCalled();
  });

  test('applies create through the atomic Role move operation', async () => {
    const deps = setup([asset('target')]);
    const preview = await inspectAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      asset('target').id,
      'Hero',
    );
    await applyAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      deps.unitOfWork,
      preview,
    );
    expect(deps.moveRole).toHaveBeenCalledWith(
      asset('target').id,
      createAssetRole('Hero'),
    );
    expect(deps.renameReferences).not.toHaveBeenCalled();
  });

  test('applies rename to Workflow references before the Asset owner', async () => {
    const deps = setup([asset('target', 'Old')]);
    const preview = await inspectAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      asset('target').id,
      'New',
    );
    await applyAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      deps.unitOfWork,
      preview,
    );
    expect(deps.renameReferences).toHaveBeenCalledWith(
      createAssetRole('Old'),
      createAssetRole('New'),
    );
    expect(deps.renameRole).toHaveBeenCalledWith(
      asset('target').id,
      createAssetRole('Old'),
      createAssetRole('New'),
    );
  });

  test('applies only an explicitly previewed move', async () => {
    const deps = setup([asset('target'), asset('owner', 'Hero')]);
    const preview = await inspectAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      asset('target').id,
      'Hero',
    );
    expect(deps.moveRole).not.toHaveBeenCalled();
    await applyAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      deps.unitOfWork,
      preview,
    );
    expect(deps.moveRole).toHaveBeenCalledWith(
      asset('target').id,
      createAssetRole('Hero'),
    );
    expect(deps.renameReferences).not.toHaveBeenCalled();
  });

  test('rejects a stale preview before writes', async () => {
    const deps = setup([asset('target')]);
    const preview = await inspectAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      asset('target').id,
      'Hero',
    );
    deps.assets.set(asset('target').id, asset('target', 'Changed'));
    await expect(
      applyAssetRoleChangeUseCase(
        deps.repository,
        deps.usage,
        deps.unitOfWork,
        preview,
      ),
    ).rejects.toBeInstanceOf(StaleAssetRoleChangeError);
    expect(deps.moveRole).not.toHaveBeenCalled();
  });

  test('rejects a stale Role owner before writes', async () => {
    const deps = setup([asset('target'), asset('owner', 'Hero')]);
    const preview = await inspectAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      asset('target').id,
      'Hero',
    );
    deps.assets.set(asset('owner').id, asset('owner'));
    deps.assets.set(asset('other').id, asset('other', 'Hero'));
    await expect(
      applyAssetRoleChangeUseCase(
        deps.repository,
        deps.usage,
        deps.unitOfWork,
        preview,
      ),
    ).rejects.toBeInstanceOf(StaleAssetRoleChangeError);
    expect(deps.moveRole).not.toHaveBeenCalled();
    expect(deps.renameReferences).not.toHaveBeenCalled();
  });

  test('unchanged preview performs no writes', async () => {
    const deps = setup([asset('target', 'Hero')]);
    const preview = await inspectAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      asset('target').id,
      'Hero',
    );
    await applyAssetRoleChangeUseCase(
      deps.repository,
      deps.usage,
      deps.unitOfWork,
      preview,
    );
    expect(deps.moveRole).not.toHaveBeenCalled();
    expect(deps.renameRole).not.toHaveBeenCalled();
    expect(deps.renameReferences).not.toHaveBeenCalled();
  });
});
