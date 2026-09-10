import { describe, expect, test, vi } from 'vitest';

import {
  createAsset,
  createAssetRole,
  type Asset,
  type AssetId,
} from '../domain/Asset';
import type { AssetRetirementRepository } from './AssetRetirement';
import type { AssetRetirementUsage } from './AssetRetirement';
import { ActiveSessionReferencedAssetError } from './ActiveSessionReferencedAssetError';
import {
  inspectAssetRetirementUseCase,
  retireAssetUseCase,
} from './assetRetirementUseCases';

const source = createAsset({
  id: 'source',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 1,
  role: 'Hero',
});
const replacement = createAsset({
  id: 'replacement',
  name: 'Meadow',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 2,
});
const usage: readonly AssetRetirementUsage[] = [
  {
    workflowId: 'workflow',
    workflowName: 'Deep work',
    occurrences: [
      {
        phaseIndex: 0,
        location: 'background',
        referenceMode: 'direct',
        optional: true,
      },
      {
        phaseIndex: 1,
        location: 'background',
        referenceMode: 'role',
        optional: true,
      },
    ],
  },
];
const policy = {
  image: { maxBytes: 10, mimeTypes: ['image/png'] },
  audio: { maxBytes: 10, mimeTypes: ['audio/mpeg'] },
} as const;

function setup() {
  const values = new Map<AssetId, Asset>([
    [source.id, source],
    [replacement.id, replacement],
  ]);
  const save = vi.fn<AssetRetirementRepository['save']>((asset) => {
    values.set(asset.id, asset);
    return Promise.resolve();
  });
  const deleteAsset = vi.fn<AssetRetirementRepository['delete']>((id) => {
    values.delete(id);
    return Promise.resolve();
  });
  const moveRole = vi.fn<AssetRetirementRepository['moveRole']>((id, role) => {
    const rolelessSource = createAsset({
      id: source.id,
      name: source.name,
      kind: source.kind,
      mimeType: source.mimeType,
      byteSize: source.byteSize,
      createdAt: source.createdAt,
    });
    const target = values.get(id);
    if (target === undefined) return Promise.reject(new Error('missing'));
    values.set(source.id, rolelessSource);
    values.set(id, createAsset({ ...target, role }));
    return Promise.resolve();
  });
  const repository: AssetRetirementRepository = {
    list: () => Promise.resolve([...values.values()]),
    get: (id) => Promise.resolve(values.get(id) ?? null),
    getBlob: () => Promise.resolve(null),
    findByRole: (role) =>
      Promise.resolve(
        [...values.values()].find(
          (asset) => asset.role?.toLowerCase() === role.toLowerCase(),
        ) ?? null,
      ),
    save,
    delete: deleteAsset,
    moveRole,
    renameRole: vi.fn(() => Promise.resolve()),
  };
  const workflows = {
    summarize: vi.fn(() => Promise.resolve(usage)),
    replace: vi.fn(() => Promise.resolve()),
    removeOptional: vi.fn(() => Promise.resolve()),
  };
  return {
    values,
    repository,
    workflows,
    active: { has: vi.fn(() => Promise.resolve(false)) },
    unitOfWork: { run: <T>(operation: () => Promise<T>) => operation() },
    writes: { save, deleteAsset, moveRole },
  };
}

test('blocks inspection on active Session use before reading Workflows', async () => {
  const deps = setup();
  deps.active.has.mockResolvedValue(true);
  await expect(
    inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    ),
  ).rejects.toBeInstanceOf(ActiveSessionReferencedAssetError);
  expect(deps.workflows.summarize).not.toHaveBeenCalled();
});

test('rejects inspection when the source Asset is missing', async () => {
  const deps = setup();
  deps.values.delete(source.id);
  await expect(
    inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    ),
  ).rejects.toThrow('Asset was not found.');
  expect(deps.workflows.summarize).not.toHaveBeenCalled();
});

describe('retireAssetUseCase', () => {
  test('rechecks active Session use inside the transaction before writes', async () => {
    const deps = setup();
    const preview = await inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    );
    deps.active.has.mockResolvedValue(true);
    await expect(
      retireAssetUseCase(
        deps.repository,
        deps.active,
        deps.workflows,
        deps.unitOfWork,
        policy,
        preview,
        { type: 'remove' },
      ),
    ).rejects.toBeInstanceOf(ActiveSessionReferencedAssetError);
    expect(deps.workflows.removeOptional).not.toHaveBeenCalled();
    expect(deps.writes.deleteAsset).not.toHaveBeenCalled();
  });

  test('rejects a stale preview before writes', async () => {
    const deps = setup();
    const firstUsage = usage[0];
    if (firstUsage === undefined) throw new Error('Expected test usage.');
    const preview = await inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    );
    deps.workflows.summarize.mockResolvedValue([
      {
        ...firstUsage,
        occurrences: [
          ...firstUsage.occurrences,
          {
            phaseIndex: 2,
            location: 'background',
            referenceMode: 'direct',
            optional: true,
          },
        ],
      },
    ]);
    await expect(
      retireAssetUseCase(
        deps.repository,
        deps.active,
        deps.workflows,
        deps.unitOfWork,
        policy,
        preview,
        { type: 'remove' },
      ),
    ).rejects.toThrow('Asset usage changed');
    expect(deps.workflows.removeOptional).not.toHaveBeenCalled();
    expect(deps.writes.deleteAsset).not.toHaveBeenCalled();
  });

  test('replaces direct references, transfers Role and deletes the source', async () => {
    const deps = setup();
    const preview = await inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    );
    await retireAssetUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      deps.unitOfWork,
      policy,
      preview,
      { type: 'existing', assetId: replacement.id },
    );
    expect(deps.workflows.replace).toHaveBeenCalledWith(source, replacement);
    expect(deps.writes.moveRole).toHaveBeenCalledWith(
      replacement.id,
      createAssetRole('Hero'),
    );
    expect(deps.writes.deleteAsset).toHaveBeenCalledWith(source.id);
  });

  test('validates and saves an uploaded same-kind replacement', async () => {
    const deps = setup();
    const preview = await inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    );
    const blob = new Blob(['x'], { type: 'image/png' });
    await retireAssetUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      deps.unitOfWork,
      policy,
      preview,
      {
        type: 'upload',
        input: {
          id: 'upload',
          name: 'New.png',
          kind: 'image',
          blob,
          createdAt: 3,
        },
      },
    );
    expect(deps.writes.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'upload', kind: 'image' }),
      blob,
    );
    expect(deps.workflows.replace).toHaveBeenCalledWith(
      source,
      expect.objectContaining({ id: 'upload' }),
    );
  });

  test('removes optional references and deletes without a replacement', async () => {
    const deps = setup();
    const preview = await inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    );
    await retireAssetUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      deps.unitOfWork,
      policy,
      preview,
      { type: 'remove' },
    );
    expect(deps.workflows.removeOptional).toHaveBeenCalledWith(source);
    expect(deps.writes.deleteAsset).toHaveBeenCalledWith(source.id);
  });

  test('rejects required-reference removal and wrong-kind replacement before writes', async () => {
    const deps = setup();
    const firstUsage = usage[0];
    if (firstUsage === undefined) throw new Error('Expected test usage.');
    deps.workflows.summarize.mockResolvedValue([
      {
        ...firstUsage,
        occurrences: [
          ...firstUsage.occurrences,
          {
            phaseIndex: 2,
            location: 'audio',
            referenceMode: 'direct',
            optional: false,
          },
        ],
      },
    ]);
    const preview = await inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    );
    await expect(
      retireAssetUseCase(
        deps.repository,
        deps.active,
        deps.workflows,
        deps.unitOfWork,
        policy,
        preview,
        { type: 'remove' },
      ),
    ).rejects.toThrow('Required Workflow references cannot be removed.');
    const audio = createAsset({
      ...replacement,
      id: 'audio',
      kind: 'audio',
      mimeType: 'audio/mpeg',
    });
    deps.values.set(audio.id, audio);
    await expect(
      retireAssetUseCase(
        deps.repository,
        deps.active,
        deps.workflows,
        deps.unitOfWork,
        policy,
        preview,
        { type: 'existing', assetId: audio.id },
      ),
    ).rejects.toThrow('same kind');
    expect(deps.workflows.replace).not.toHaveBeenCalled();
    expect(deps.workflows.removeOptional).not.toHaveBeenCalled();
    expect(deps.writes.deleteAsset).not.toHaveBeenCalled();
  });

  test('rejects a conflicting replacement Role before Workflow or Asset writes', async () => {
    const deps = setup();
    const occupied = createAsset({
      ...replacement,
      id: 'occupied',
      role: 'Other',
    });
    deps.values.set(occupied.id, occupied);
    const preview = await inspectAssetRetirementUseCase(
      deps.repository,
      deps.active,
      deps.workflows,
      source.id,
    );
    await expect(
      retireAssetUseCase(
        deps.repository,
        deps.active,
        deps.workflows,
        deps.unitOfWork,
        policy,
        preview,
        { type: 'existing', assetId: occupied.id },
      ),
    ).rejects.toThrow('different Role');
    expect(deps.writes.save).not.toHaveBeenCalled();
    expect(deps.workflows.replace).not.toHaveBeenCalled();
    expect(deps.writes.moveRole).not.toHaveBeenCalled();
    expect(deps.writes.deleteAsset).not.toHaveBeenCalled();
  });
});
