import {
  validateAssetImport,
  type Asset,
  type AssetImportPolicy,
  type AssetRepository,
} from '@/features/assets';

import { createWorkflow } from '../domain/createWorkflow';
import type { Workflow } from '../domain/Workflow';
import type { WorkflowRepository } from './WorkflowRepository';
import {
  WorkflowPackageValidationError,
  type WorkflowPackageUnitOfWork,
} from './WorkflowPackage';
import { parseWorkflow } from './workflowPackageMapping';

export type WorkflowImportOptions = Readonly<{
  maxFileBytes: number;
  assetPolicy: AssetImportPolicy;
}>;

export type WorkflowImportIdentity = Readonly<{
  createWorkflowId(): string;
  createAssetId(): string;
  now(): number;
}>;

type DecodedAsset = Readonly<{
  oldId: string;
  asset: Asset;
  blob: Blob;
}>;

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WorkflowPackageValidationError();
  }
  return value as Readonly<Record<string, unknown>>;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new WorkflowPackageValidationError();
  return value;
}

function number(value: unknown): number {
  if (typeof value !== 'number') throw new WorkflowPackageValidationError();
  return value;
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new WorkflowPackageValidationError();
  }
}

function referencedIds(
  workflow: Workflow,
): ReadonlyMap<string, 'image' | 'audio'> {
  const references = new Map<string, 'image' | 'audio'>();
  for (const { environment } of workflow.phases) {
    if (environment.backgroundAssetId !== undefined) {
      references.set(environment.backgroundAssetId, 'image');
    }
    if (environment.audioAssetId !== undefined) {
      references.set(environment.audioAssetId, 'audio');
    }
  }
  return references;
}

function parseAsset(
  value: unknown,
  policy: AssetImportPolicy,
  identity: WorkflowImportIdentity,
): DecodedAsset {
  const input = record(value);
  if (
    Object.keys(input).length !== 6 ||
    !['id', 'name', 'kind', 'mimeType', 'byteSize', 'dataBase64'].every((key) =>
      Object.hasOwn(input, key),
    )
  ) {
    throw new WorkflowPackageValidationError();
  }
  const oldId = string(input['id']);
  const name = string(input['name']);
  const kind = string(input['kind']);
  const mimeType = string(input['mimeType']);
  const declaredSize = number(input['byteSize']);
  const bytes = decodeBase64(string(input['dataBase64']));
  if (kind !== 'image' && kind !== 'audio') {
    throw new WorkflowPackageValidationError();
  }
  if (bytes.byteLength !== declaredSize) {
    throw new WorkflowPackageValidationError();
  }
  const blob = new Blob([bytes], { type: mimeType });
  let asset: Asset;
  try {
    asset = validateAssetImport(policy, {
      id: identity.createAssetId(),
      name,
      kind,
      blob,
      createdAt: identity.now(),
    });
  } catch {
    throw new WorkflowPackageValidationError();
  }
  return { oldId, asset, blob };
}

function nextUniqueId(createId: () => string, reserved: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = createId();
    if (!reserved.has(candidate)) {
      reserved.add(candidate);
      return candidate;
    }
  }
  throw new WorkflowPackageValidationError(
    'Could not generate a unique imported identifier.',
  );
}

export async function importWorkflowUseCase(
  workflows: WorkflowRepository,
  assets: AssetRepository,
  unitOfWork: WorkflowPackageUnitOfWork,
  data: string,
  options: WorkflowImportOptions,
  identity: WorkflowImportIdentity,
): Promise<Workflow> {
  if (new TextEncoder().encode(data).byteLength > options.maxFileBytes) {
    throw new WorkflowPackageValidationError(
      'Workflow package exceeds the configured file size limit.',
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(data) as unknown;
  } catch {
    throw new WorkflowPackageValidationError();
  }
  const envelope = record(decoded);
  if (
    Object.keys(envelope).length !== 4 ||
    envelope['kind'] !== 'locusora/workflow' ||
    envelope['version'] !== 1 ||
    !Array.isArray(envelope['assets'])
  ) {
    throw new WorkflowPackageValidationError();
  }
  const sourceWorkflow = parseWorkflow(envelope['workflow']);
  const reservedAssetIds = new Set(
    (await assets.list()).map((asset) => String(asset.id)),
  );
  const importIdentity: WorkflowImportIdentity = {
    ...identity,
    createAssetId: () => nextUniqueId(identity.createAssetId, reservedAssetIds),
  };
  const decodedAssets = envelope['assets'].map((value) =>
    parseAsset(value, options.assetPolicy, importIdentity),
  );
  const assetsByOldId = new Map(
    decodedAssets.map((value) => [value.oldId, value]),
  );
  if (assetsByOldId.size !== decodedAssets.length) {
    throw new WorkflowPackageValidationError();
  }
  const references = referencedIds(sourceWorkflow);
  if (
    references.size !== decodedAssets.length ||
    [...references].some(
      ([id, expectedKind]) =>
        assetsByOldId.get(id)?.asset.kind !== expectedKind,
    )
  ) {
    throw new WorkflowPackageValidationError();
  }
  const rewrite = (oldId: string | undefined): string | undefined =>
    oldId === undefined ? undefined : assetsByOldId.get(oldId)?.asset.id;
  const reservedWorkflowIds = new Set(
    (await workflows.list()).map((workflow) => String(workflow.id)),
  );
  const imported = createWorkflow({
    id: nextUniqueId(identity.createWorkflowId, reservedWorkflowIds),
    name: sourceWorkflow.name,
    phases: sourceWorkflow.phases.map((phase) => {
      const backgroundAssetId = rewrite(phase.environment.backgroundAssetId);
      const audioAssetId = rewrite(phase.environment.audioAssetId);
      return {
        type: phase.type,
        durationSeconds: phase.durationSeconds,
        environment: {
          ...(backgroundAssetId === undefined ? {} : { backgroundAssetId }),
          ...(audioAssetId === undefined ? {} : { audioAssetId }),
          ...(phase.environment.backgroundColor === undefined
            ? {}
            : { backgroundColor: phase.environment.backgroundColor }),
        },
      };
    }),
    ...(sourceWorkflow.rewardDice === undefined
      ? {}
      : {
          rewardDice: {
            triggerPhaseType: sourceWorkflow.rewardDice.triggerPhaseType,
            frequency: sourceWorkflow.rewardDice.frequency,
            rerolls: sourceWorkflow.rewardDice.rerolls,
            sides: sourceWorkflow.rewardDice.sides.map((side) => ({
              icon: side.icon,
              title: side.title,
              ...(side.description === undefined
                ? {}
                : { description: side.description }),
              weight: side.probability,
            })),
          },
        }),
  });

  return unitOfWork.run(async () => {
    for (const decodedAsset of decodedAssets) {
      await assets.save(decodedAsset.asset, decodedAsset.blob);
    }
    await workflows.save(imported);
    return imported;
  });
}
