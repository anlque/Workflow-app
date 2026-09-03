import { describe, expect, test } from 'vitest';

import {
  createAsset,
  createAssetId,
  type Asset,
  type AssetId,
  type AssetImportPolicy,
  type AssetRepository,
} from '@/features/assets';

import { createWorkflow } from '../domain/createWorkflow';
import type { Workflow, WorkflowId } from '../domain/Workflow';
import type { WorkflowRepository } from './WorkflowRepository';
import { exportWorkflowUseCase } from './exportWorkflowUseCase';
import { importWorkflowUseCase } from './importWorkflowUseCase';
import type { WorkflowPackageUnitOfWork } from './WorkflowPackage';

class MemoryWorkflowRepository implements WorkflowRepository {
  values: Workflow[] = [];
  writes = 0;

  public list(): Promise<readonly Workflow[]> {
    return Promise.resolve(this.values);
  }
  public get(id: WorkflowId): Promise<Workflow | null> {
    return Promise.resolve(
      this.values.find((value) => value.id === id) ?? null,
    );
  }
  public save(workflow: Workflow): Promise<void> {
    this.writes += 1;
    this.values.push(workflow);
    return Promise.resolve();
  }
  public delete(): Promise<void> {
    return Promise.resolve();
  }
  public replaceOrder(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryAssetRepository implements AssetRepository {
  readonly values = new Map<AssetId, Readonly<{ asset: Asset; blob: Blob }>>();
  writes = 0;

  public list(): Promise<readonly Asset[]> {
    return Promise.resolve([...this.values.values()].map(({ asset }) => asset));
  }
  public getBlob(id: AssetId): Promise<Blob | null> {
    return Promise.resolve(this.values.get(id)?.blob ?? null);
  }
  public save(asset: Asset, blob: Blob): Promise<void> {
    this.writes += 1;
    this.values.set(asset.id, { asset, blob });
    return Promise.resolve();
  }
  public delete(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryUnitOfWork implements WorkflowPackageUnitOfWork {
  runs = 0;
  public async run<Result>(operation: () => Promise<Result>): Promise<Result> {
    this.runs += 1;
    return operation();
  }
}

const policy: AssetImportPolicy = {
  image: { maxBytes: 100, mimeTypes: ['image/png'] },
  audio: { maxBytes: 100, mimeTypes: ['audio/mpeg'] },
};

function workflow(): Workflow {
  return createWorkflow({
    id: 'workflow-old',
    name: 'Deep work',
    phases: [
      {
        type: 'focus',
        durationSeconds: 10,
        environment: { backgroundAssetId: 'asset-used' },
      },
    ],
  });
}

function rewardedWorkflow(): Workflow {
  return createWorkflow({
    id: 'workflow-rewarded',
    name: 'Focus and recover',
    phases: [{ type: 'break', durationSeconds: 10, environment: {} }],
    rewardDice: {
      triggerPhaseType: 'break',
      frequency: 1,
      rerolls: 3,
      sides: [
        { icon: 'tea', title: 'Tea' },
        { icon: 'walk', title: 'Walk' },
      ],
    },
  });
}

async function addAsset(
  repository: MemoryAssetRepository,
  id: string,
): Promise<void> {
  const blob = new Blob([id], { type: 'image/png' });
  await repository.save(
    createAsset({
      id,
      name: id,
      kind: 'image',
      mimeType: blob.type,
      byteSize: blob.size,
      createdAt: 1_000,
    }),
    blob,
  );
}

describe('Workflow package', () => {
  test('preserves the Reward Dice trigger phase through export and import', async () => {
    const data = await exportWorkflowUseCase(
      rewardedWorkflow(),
      new MemoryAssetRepository(),
    );
    const workflows = new MemoryWorkflowRepository();

    const imported = await importWorkflowUseCase(
      workflows,
      new MemoryAssetRepository(),
      new MemoryUnitOfWork(),
      data,
      { maxFileBytes: 10_000, assetPolicy: policy },
      {
        createWorkflowId: () => 'workflow-new',
        createAssetId: () => 'asset-new',
        now: () => 2_000,
      },
    );

    expect(JSON.parse(data)).toMatchObject({
      kind: 'locusora/workflow',
      workflow: { rewardDice: { triggerPhaseType: 'break', rerolls: 3 } },
    });
    expect(imported.rewardDice?.triggerPhaseType).toBe('break');
    expect(imported.rewardDice?.rerolls).toBe(3);
  });

  test('defaults missing version-1 Reward Dice rerolls during import', async () => {
    const exported = await exportWorkflowUseCase(
      rewardedWorkflow(),
      new MemoryAssetRepository(),
    );
    const legacyPackage = JSON.parse(exported) as {
      workflow: { rewardDice?: Record<string, unknown> };
    };
    const legacyReward = legacyPackage.workflow.rewardDice;
    if (legacyReward === undefined) {
      throw new Error('Expected exported Reward Dice.');
    }
    delete legacyReward['rerolls'];

    const imported = await importWorkflowUseCase(
      new MemoryWorkflowRepository(),
      new MemoryAssetRepository(),
      new MemoryUnitOfWork(),
      JSON.stringify(legacyPackage),
      { maxFileBytes: 10_000, assetPolicy: policy },
      {
        createWorkflowId: () => 'workflow-new',
        createAssetId: () => 'asset-new',
        now: () => 2_000,
      },
    );

    expect(imported.rewardDice?.rerolls).toBe(0);
  });

  test('exports only referenced Assets with deterministic transport-safe encoding', async () => {
    const assets = new MemoryAssetRepository();
    await addAsset(assets, 'asset-unused');
    await addAsset(assets, 'asset-used');

    const first = await exportWorkflowUseCase(workflow(), assets);
    const second = await exportWorkflowUseCase(workflow(), assets);
    const parsed = JSON.parse(first) as {
      assets: { id: string; dataBase64: string }[];
    };

    expect(second).toBe(first);
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.assets[0]?.id).toBe('asset-used');
    expect(parsed.assets[0]?.dataBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  test('imports with new identifiers and rewrites Environment references atomically', async () => {
    const sourceAssets = new MemoryAssetRepository();
    await addAsset(sourceAssets, 'asset-used');
    const data = await exportWorkflowUseCase(workflow(), sourceAssets);
    const workflows = new MemoryWorkflowRepository();
    const assets = new MemoryAssetRepository();
    const unitOfWork = new MemoryUnitOfWork();

    const imported = await importWorkflowUseCase(
      workflows,
      assets,
      unitOfWork,
      data,
      { maxFileBytes: 10_000, assetPolicy: policy },
      {
        createWorkflowId: () => 'workflow-new',
        createAssetId: () => 'asset-new',
        now: () => 2_000,
      },
    );

    expect(imported.id).toBe('workflow-new');
    expect(imported.phases[0].environment.backgroundAssetId).toBe('asset-new');
    expect([...assets.values.keys()]).toEqual([createAssetId('asset-new')]);
    expect(unitOfWork.runs).toBe(1);
  });

  test('regenerates identifiers that collide with existing records', async () => {
    const sourceAssets = new MemoryAssetRepository();
    await addAsset(sourceAssets, 'asset-used');
    const data = await exportWorkflowUseCase(workflow(), sourceAssets);
    const workflows = new MemoryWorkflowRepository();
    workflows.values.push(
      createWorkflow({
        id: 'workflow-collision',
        name: 'Existing',
        phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      }),
    );
    const assets = new MemoryAssetRepository();
    await addAsset(assets, 'asset-collision');
    assets.writes = 0;
    const workflowIds = ['workflow-collision', 'workflow-new'];
    const assetIds = ['asset-collision', 'asset-new'];

    const imported = await importWorkflowUseCase(
      workflows,
      assets,
      new MemoryUnitOfWork(),
      data,
      { maxFileBytes: 10_000, assetPolicy: policy },
      {
        createWorkflowId: () => workflowIds.shift() ?? 'workflow-fallback',
        createAssetId: () => assetIds.shift() ?? 'asset-fallback',
        now: () => 2_000,
      },
    );

    expect(imported.id).toBe('workflow-new');
    expect(imported.phases[0].environment.backgroundAssetId).toBe('asset-new');
    expect([...assets.values.keys()]).toEqual([
      createAssetId('asset-collision'),
      createAssetId('asset-new'),
    ]);
  });

  test.each([
    ['unsupported version', '{"kind":"locusora/workflow","version":2}'],
    [
      'corrupt package',
      '{"kind":"locusora/workflow","version":1,"workflow":{},"assets":[]}',
    ],
    ['invalid JSON', '{'],
  ])('rejects %s with zero writes', async (_case, data) => {
    const workflows = new MemoryWorkflowRepository();
    const assets = new MemoryAssetRepository();
    const unitOfWork = new MemoryUnitOfWork();

    await expect(
      importWorkflowUseCase(
        workflows,
        assets,
        unitOfWork,
        data,
        { maxFileBytes: 10_000, assetPolicy: policy },
        {
          createWorkflowId: () => 'workflow-new',
          createAssetId: () => 'asset-new',
          now: () => 2_000,
        },
      ),
    ).rejects.toThrow();
    expect(workflows.writes).toBe(0);
    expect(assets.writes).toBe(0);
    expect(unitOfWork.runs).toBe(0);
  });

  test('rejects oversized files before writes', async () => {
    const workflows = new MemoryWorkflowRepository();
    const assets = new MemoryAssetRepository();
    const unitOfWork = new MemoryUnitOfWork();

    await expect(
      importWorkflowUseCase(
        workflows,
        assets,
        unitOfWork,
        '{}',
        { maxFileBytes: 1, assetPolicy: policy },
        {
          createWorkflowId: () => 'workflow-new',
          createAssetId: () => 'asset-new',
          now: () => 2_000,
        },
      ),
    ).rejects.toThrow(
      'Workflow package exceeds the configured file size limit.',
    );
    expect(unitOfWork.runs).toBe(0);
  });

  test('rejects oversized decoded Assets before starting the transaction', async () => {
    const sourceAssets = new MemoryAssetRepository();
    await addAsset(sourceAssets, 'asset-used');
    const data = await exportWorkflowUseCase(workflow(), sourceAssets);
    const workflows = new MemoryWorkflowRepository();
    const assets = new MemoryAssetRepository();
    const unitOfWork = new MemoryUnitOfWork();

    await expect(
      importWorkflowUseCase(
        workflows,
        assets,
        unitOfWork,
        data,
        {
          maxFileBytes: 10_000,
          assetPolicy: {
            ...policy,
            image: { ...policy.image, maxBytes: 1 },
          },
        },
        {
          createWorkflowId: () => 'workflow-new',
          createAssetId: () => 'asset-new',
          now: () => 2_000,
        },
      ),
    ).rejects.toThrow();
    expect(workflows.writes).toBe(0);
    expect(assets.writes).toBe(0);
    expect(unitOfWork.runs).toBe(0);
  });
});
