import { describe, expect, test, vi } from 'vitest';

import {
  createAsset,
  createAssetRole,
  type Asset,
  type AssetImportPolicy,
  type AssetRole,
} from '@/features/assets';
import {
  createWorkflow,
  type CreateWorkflowInput,
  type Workflow,
} from '@/features/workflow';

import type {
  PackagedSeedFileLoader,
  StarterContentRegistry,
  StarterContentTransaction,
  StarterContentUnitOfWork,
} from './StarterContentPorts';
import type { StarterContentSeedVersion } from './StarterContentSeed';
import { StarterContentConflictError } from './StarterContentErrors';
import { seedStarterContentUseCase } from './seedStarterContentUseCase';

const policy: AssetImportPolicy = {
  image: { maxBytes: 1_024, mimeTypes: ['image/webp'] },
  audio: { maxBytes: 1_024, mimeTypes: ['audio/ogg'] },
};

const workflowInput: CreateWorkflowInput = {
  id: 'locusora:seed:v1:workflow:focus',
  name: 'Starter focus',
  phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
};

const seed: StarterContentSeedVersion = {
  version: 1,
  assets: [
    {
      id: 'locusora:seed:v1:asset:forest',
      kind: 'image',
      mimeType: 'image/webp',
      name: 'Forest',
      path: '/seed/backgrounds/forest.webp',
      role: 'Starter forest',
    },
  ],
  workflows: [workflowInput],
};
const seedAsset = seed.assets[0];
if (seedAsset === undefined) throw new Error('Seed Asset missing.');

type State = {
  assets: Map<string, Readonly<{ asset: Asset; blob: Blob }>>;
  completed: Set<number>;
  workflows: Map<string, Workflow>;
};

function cloneState(state: State): State {
  return {
    assets: new Map(state.assets),
    completed: new Set(state.completed),
    workflows: new Map(state.workflows),
  };
}

class MemoryStarterContentStore
  implements StarterContentRegistry, StarterContentUnitOfWork
{
  readonly operations: string[] = [];
  readonly state: State = {
    assets: new Map(),
    completed: new Set(),
    workflows: new Map(),
  };
  failAt: string | undefined;
  #queue = Promise.resolve();

  public isCompleted(version: number): Promise<boolean> {
    return Promise.resolve(this.state.completed.has(version));
  }

  public run<Result>(
    operation: (transaction: StarterContentTransaction) => Promise<Result>,
  ): Promise<Result> {
    const result = this.#queue.then(async () => {
      const next = cloneState(this.state);
      const transaction: StarterContentTransaction = {
        isCompleted: (version) => Promise.resolve(next.completed.has(version)),
        findAssetById: (id) =>
          Promise.resolve(next.assets.get(id)?.asset ?? null),
        findAssetByRole: (role) =>
          Promise.resolve(
            [...next.assets.values()].find(
              ({ asset }) => asset.role?.toLowerCase() === role.toLowerCase(),
            )?.asset ?? null,
          ),
        findWorkflowById: (id) =>
          Promise.resolve(next.workflows.get(id) ?? null),
        addAsset: (asset, blob) => {
          this.operations.push(`asset:${asset.id}`);
          if (this.failAt === 'asset') throw new Error('asset write failed');
          next.assets.set(asset.id, { asset, blob });
          return Promise.resolve();
        },
        addWorkflow: (workflow) => {
          this.operations.push(`workflow:${workflow.id}`);
          if (this.failAt === 'workflow')
            throw new Error('workflow write failed');
          next.workflows.set(workflow.id, workflow);
          return Promise.resolve();
        },
        complete: (version) => {
          this.operations.push(`marker:${String(version)}`);
          if (this.failAt === 'marker') throw new Error('marker write failed');
          next.completed.add(version);
          return Promise.resolve();
        },
      };
      const value = await operation(transaction);
      this.state.assets = next.assets;
      this.state.completed = next.completed;
      this.state.workflows = next.workflows;
      return value;
    });
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function dependencies(
  store = new MemoryStarterContentStore(),
  load = vi.fn((path: string) =>
    Promise.resolve(
      path.endsWith('.ogg')
        ? new Blob(['audio'], { type: 'audio/ogg' })
        : new Blob(['image'], { type: 'image/webp' }),
    ),
  ),
) {
  const files: PackagedSeedFileLoader = { load };
  return {
    input: {
      assetPolicy: policy,
      files,
      now: () => 123,
      registry: store,
      unitOfWork: store,
    },
    load,
    store,
  };
}

describe('seedStarterContentUseCase', () => {
  test('creates one complete Asset and Workflow batch with the marker last', async () => {
    const { input, store } = dependencies();

    await expect(seedStarterContentUseCase(input, seed)).resolves.toBe(
      'seeded',
    );

    expect(store.state.assets.get(seedAsset.id)?.asset).toMatchObject({
      createdAt: 123,
      name: 'Forest',
      role: 'Starter forest',
    });
    expect(store.state.workflows.get(workflowInput.id)).toEqual(
      createWorkflow(workflowInput),
    );
    expect(store.state.completed).toEqual(new Set([1]));
    expect(store.operations).toEqual([
      `asset:${seedAsset.id}`,
      `workflow:${workflowInput.id}`,
      'marker:1',
    ]);
  });

  test('a completed version performs no file loading or writes and does not restore deleted content', async () => {
    const { input, load, store } = dependencies();
    store.state.completed.add(1);

    await expect(seedStarterContentUseCase(input, seed)).resolves.toBe(
      'already-completed',
    );

    expect(load).not.toHaveBeenCalled();
    expect(store.operations).toEqual([]);
    expect(store.state.assets.size).toBe(0);
  });

  test('preserves unrelated user records', async () => {
    const { input, store } = dependencies();
    const userAsset = createAsset({
      id: 'user-asset',
      name: 'User image',
      kind: 'image',
      mimeType: 'image/webp',
      byteSize: 4,
      createdAt: 50,
    });
    store.state.assets.set(userAsset.id, {
      asset: userAsset,
      blob: new Blob(['user'], { type: 'image/webp' }),
    });

    await seedStarterContentUseCase(input, seed);

    expect(store.state.assets.get(userAsset.id)?.asset).toEqual(userAsset);
    expect(store.state.assets.size).toBe(2);
  });

  test.each([
    ['Asset ID', 'asset-id'],
    ['Asset Role', 'asset-role'],
    ['Workflow ID', 'workflow-id'],
  ] as const)(
    'rejects an existing %s before any write',
    async (_, conflict) => {
      const { input, store } = dependencies();
      if (conflict === 'asset-id') {
        const asset = createAsset({
          id: seedAsset.id,
          name: 'Existing',
          kind: 'image',
          mimeType: 'image/webp',
          byteSize: 1,
          createdAt: 1,
        });
        store.state.assets.set(asset.id, {
          asset,
          blob: new Blob(['x'], { type: 'image/webp' }),
        });
      } else if (conflict === 'asset-role') {
        const role: AssetRole = createAssetRole('  starter   FOREST ');
        const asset = createAsset({
          id: 'other',
          name: 'Existing',
          kind: 'image',
          mimeType: 'image/webp',
          byteSize: 1,
          createdAt: 1,
          role,
        });
        store.state.assets.set(asset.id, {
          asset,
          blob: new Blob(['x'], { type: 'image/webp' }),
        });
      } else {
        store.state.workflows.set(
          workflowInput.id,
          createWorkflow({ ...workflowInput, name: 'Existing' }),
        );
      }

      await expect(
        seedStarterContentUseCase(input, seed),
      ).rejects.toBeInstanceOf(StarterContentConflictError);
      expect(store.operations).toEqual([]);
      expect(store.state.completed.size).toBe(0);
    },
  );

  test.each(['asset', 'workflow', 'marker'] as const)(
    'rolls back when the %s write fails',
    async (stage) => {
      const { input, store } = dependencies();
      store.failAt = stage;

      await expect(seedStarterContentUseCase(input, seed)).rejects.toThrow(
        `${stage} write failed`,
      );

      expect(store.state.assets.size).toBe(0);
      expect(store.state.workflows.size).toBe(0);
      expect(store.state.completed.size).toBe(0);
    },
  );

  test('load and validation failures occur before the transaction', async () => {
    const failedLoad = dependencies(
      undefined,
      vi.fn(() => Promise.reject(new Error('load failed'))),
    );
    await expect(
      seedStarterContentUseCase(failedLoad.input, seed),
    ).rejects.toThrow('load failed');
    expect(failedLoad.store.operations).toEqual([]);

    const invalid = dependencies(
      undefined,
      vi.fn(() => Promise.resolve(new Blob([], { type: 'image/webp' }))),
    );
    await expect(
      seedStarterContentUseCase(invalid.input, seed),
    ).rejects.toThrow('Asset content must not be empty.');
    expect(invalid.store.operations).toEqual([]);
  });

  test('concurrent calls commit one batch and one marker', async () => {
    const { input, store } = dependencies();

    await expect(
      Promise.all([
        seedStarterContentUseCase(input, seed),
        seedStarterContentUseCase(input, seed),
      ]),
    ).resolves.toEqual(['seeded', 'already-completed']);

    expect(store.state.assets.size).toBe(1);
    expect(store.state.workflows.size).toBe(1);
    expect(store.state.completed).toEqual(new Set([1]));
  });

  test('a later version runs independently once', async () => {
    const { input, store } = dependencies();
    store.state.completed.add(1);
    const versionTwo: StarterContentSeedVersion = {
      version: 2,
      assets: [],
      workflows: [
        { ...workflowInput, id: 'locusora:seed:v2:workflow:example' },
      ],
    };

    await expect(seedStarterContentUseCase(input, versionTwo)).resolves.toBe(
      'seeded',
    );
    await expect(seedStarterContentUseCase(input, versionTwo)).resolves.toBe(
      'already-completed',
    );

    expect(store.state.completed).toEqual(new Set([1, 2]));
    expect(store.state.workflows.size).toBe(1);
  });
});
