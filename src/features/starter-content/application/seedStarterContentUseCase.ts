import {
  assetRoleKey,
  createAssetRole,
  validateAssetImport,
  type Asset,
  type AssetImportPolicy,
} from '@/features/assets';
import { createWorkflow, type Workflow } from '@/features/workflow';

import {
  StarterContentConflictError,
  StarterContentValidationError,
} from './StarterContentErrors';
import type {
  PackagedSeedFileLoader,
  StarterContentRegistry,
  StarterContentUnitOfWork,
} from './StarterContentPorts';
import type {
  PackagedAssetSeed,
  StarterContentSeedVersion,
} from './StarterContentSeed';

export type SeedStarterContentDependencies = Readonly<{
  assetPolicy: AssetImportPolicy;
  files: PackagedSeedFileLoader;
  registry: StarterContentRegistry;
  unitOfWork: StarterContentUnitOfWork;
  now(): number;
}>;

export type StarterContentSeedResult = 'seeded' | 'already-completed';

type PreparedAsset = Readonly<{ asset: Asset; blob: Blob }>;

function validateSeedDefinition(seed: StarterContentSeedVersion): void {
  if (!Number.isSafeInteger(seed.version) || seed.version <= 0) {
    throw new StarterContentValidationError(
      'Starter content version must be a positive integer.',
    );
  }
  const assetIds = new Set<string>();
  const roleKeys = new Set<string>();
  for (const asset of seed.assets) {
    if (assetIds.has(asset.id)) {
      throw new StarterContentValidationError(
        `Starter content contains duplicate Asset ID ${asset.id}.`,
      );
    }
    assetIds.add(asset.id);
    const roleKey = assetRoleKey(createAssetRole(asset.role));
    if (roleKeys.has(roleKey)) {
      throw new StarterContentValidationError(
        `Starter content contains duplicate Asset Role ${asset.role}.`,
      );
    }
    roleKeys.add(roleKey);
    if (!asset.path.startsWith('/')) {
      throw new StarterContentValidationError(
        'Starter Asset paths must be extension-local absolute paths.',
      );
    }
  }
  const workflowIds = new Set<string>();
  for (const workflow of seed.workflows) {
    if (workflowIds.has(workflow.id)) {
      throw new StarterContentValidationError(
        `Starter content contains duplicate Workflow ID ${workflow.id}.`,
      );
    }
    workflowIds.add(workflow.id);
  }
}

async function prepareAsset(
  dependencies: SeedStarterContentDependencies,
  seed: PackagedAssetSeed,
  createdAt: number,
): Promise<PreparedAsset> {
  const blob = await dependencies.files.load(seed.path);
  if (blob.type !== seed.mimeType) {
    throw new StarterContentValidationError(
      `Packaged Asset ${seed.path} has MIME type ${blob.type || '(empty)'} instead of ${seed.mimeType}.`,
    );
  }
  const asset = validateAssetImport(dependencies.assetPolicy, {
    id: seed.id,
    name: seed.name,
    kind: seed.kind,
    role: seed.role,
    blob,
    createdAt,
  });
  return { asset, blob };
}

export async function seedStarterContentUseCase(
  dependencies: SeedStarterContentDependencies,
  seed: StarterContentSeedVersion,
): Promise<StarterContentSeedResult> {
  validateSeedDefinition(seed);
  if (await dependencies.registry.isCompleted(seed.version)) {
    return 'already-completed';
  }

  const completedAt = dependencies.now();
  const assets = await Promise.all(
    seed.assets.map((asset) => prepareAsset(dependencies, asset, completedAt)),
  );
  const workflows: readonly Workflow[] = seed.workflows.map(createWorkflow);

  return dependencies.unitOfWork.run(async (transaction) => {
    if (await transaction.isCompleted(seed.version)) {
      return 'already-completed';
    }

    for (const { asset } of assets) {
      if ((await transaction.findAssetById(asset.id)) !== null) {
        throw new StarterContentConflictError(
          `Starter Asset ID ${asset.id} is already in use.`,
        );
      }
      if (
        asset.role !== undefined &&
        (await transaction.findAssetByRole(asset.role)) !== null
      ) {
        throw new StarterContentConflictError(
          `Starter Asset Role ${asset.role} is already in use.`,
        );
      }
    }
    for (const workflow of workflows) {
      if ((await transaction.findWorkflowById(workflow.id)) !== null) {
        throw new StarterContentConflictError(
          `Starter Workflow ID ${workflow.id} is already in use.`,
        );
      }
    }

    for (const { asset, blob } of assets) {
      await transaction.addAsset(asset, blob);
    }
    for (const workflow of workflows) {
      await transaction.addWorkflow(workflow);
    }
    await transaction.complete(seed.version, completedAt);
    return 'seeded';
  });
}
