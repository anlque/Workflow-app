import type { Table } from 'dexie';

import {
  DexieAssetRepository,
  type Asset,
  type AssetId,
  type AssetRole,
} from '@/features/assets';
import {
  DexieWorkflowRepository,
  type Workflow,
  type WorkflowId,
} from '@/features/workflow';
import type { LocusoraDatabase } from '@/platform/storage';

import { StarterContentValidationError } from '../application/StarterContentErrors';
import type {
  StarterContentRegistry,
  StarterContentTransaction,
  StarterContentUnitOfWork,
} from '../application/StarterContentPorts';
import type { StarterContentSeedRecord } from './StarterContentSeedRecord';

function parseRecord(value: unknown): StarterContentSeedRecord {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'completedAt,version'
  ) {
    throw new StarterContentValidationError(
      'Stored starter-content marker is invalid.',
    );
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (
    !Number.isSafeInteger(record['version']) ||
    (record['version'] as number) <= 0 ||
    typeof record['completedAt'] !== 'number' ||
    !Number.isFinite(record['completedAt']) ||
    record['completedAt'] < 0
  ) {
    throw new StarterContentValidationError(
      'Stored starter-content marker is invalid.',
    );
  }
  return {
    version: record['version'] as number,
    completedAt: record['completedAt'],
  };
}

function validateVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new StarterContentValidationError(
      'Starter content version must be a positive integer.',
    );
  }
}

export class DexieStarterContentUnitOfWork
  implements StarterContentRegistry, StarterContentUnitOfWork
{
  readonly #database: LocusoraDatabase;
  readonly #markers: Table<StarterContentSeedRecord, number>;
  readonly #assets: DexieAssetRepository;
  readonly #workflows: DexieWorkflowRepository;

  public constructor(database: LocusoraDatabase) {
    this.#database = database;
    this.#markers = database.table<StarterContentSeedRecord, number>(
      'starterContentSeeds',
    );
    this.#assets = new DexieAssetRepository(database);
    this.#workflows = new DexieWorkflowRepository(database);
  }

  public async isCompleted(version: number): Promise<boolean> {
    validateVersion(version);
    const value: unknown = await this.#markers.get(version);
    if (value === undefined) return false;
    parseRecord(value);
    return true;
  }

  public run<Result>(
    operation: (transaction: StarterContentTransaction) => Promise<Result>,
  ): Promise<Result> {
    return this.#database.runReadWriteMany(
      ['starterContentSeeds', 'assets', 'workflows'],
      () => operation(this.#transaction()),
    );
  }

  #transaction(): StarterContentTransaction {
    return {
      isCompleted: (version) => this.isCompleted(version),
      findAssetById: (id: AssetId) => this.#assets.get(id),
      findAssetByRole: (role: AssetRole) => this.#assets.findByRole(role),
      findWorkflowById: (id: WorkflowId) => this.#workflows.get(id),
      addAsset: (asset: Asset, blob: Blob) => this.#assets.save(asset, blob),
      addWorkflow: (workflow: Workflow) => this.#workflows.save(workflow),
      complete: async (version, completedAt) => {
        validateVersion(version);
        const record = parseRecord({ version, completedAt });
        await this.#markers.add(record);
      },
    };
  }
}
