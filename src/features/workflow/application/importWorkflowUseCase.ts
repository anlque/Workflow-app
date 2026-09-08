import {
  assetRoleKey,
  createAsset,
  createAssetRole,
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

type PackageReferences = Readonly<{
  direct: ReadonlyMap<string, 'image' | 'audio'>;
  roles: ReadonlyMap<string, 'image' | 'audio'>;
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

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : string(value);
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

function packageReferences(workflow: Workflow): PackageReferences {
  const direct = new Map<string, 'image' | 'audio'>();
  const roles = new Map<string, 'image' | 'audio'>();
  const add = (
    target: Map<string, 'image' | 'audio'>,
    key: string,
    kind: 'image' | 'audio',
  ): void => {
    const existing = target.get(key);
    if (existing !== undefined && existing !== kind) {
      throw new WorkflowPackageValidationError();
    }
    target.set(key, kind);
  };
  for (const { environment } of workflow.phases) {
    if (environment.backgroundAsset?.type === 'direct') {
      add(direct, environment.backgroundAsset.assetId, 'image');
    } else if (environment.backgroundAsset?.type === 'role') {
      add(roles, assetRoleKey(environment.backgroundAsset.role), 'image');
    }
    if (environment.audioAsset?.type === 'direct') {
      add(direct, environment.audioAsset.assetId, 'audio');
    } else if (environment.audioAsset?.type === 'role') {
      add(roles, assetRoleKey(environment.audioAsset.role), 'audio');
    }
  }
  return { direct, roles };
}

function parseAsset(
  value: unknown,
  version: 1 | 2,
  policy: AssetImportPolicy,
  identity: WorkflowImportIdentity,
): DecodedAsset {
  const input = record(value);
  const requiredKeys = [
    'id',
    'name',
    'kind',
    'mimeType',
    'byteSize',
    'dataBase64',
  ];
  const keys = Object.keys(input);
  if (
    !requiredKeys.every((key) => Object.hasOwn(input, key)) ||
    !keys.every(
      (key) => requiredKeys.includes(key) || (version === 2 && key === 'role'),
    )
  ) {
    throw new WorkflowPackageValidationError();
  }
  const oldId = string(input['id']);
  const name = string(input['name']);
  const kind = string(input['kind']);
  const mimeType = string(input['mimeType']);
  const declaredSize = number(input['byteSize']);
  const role = optionalString(input['role']);
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
      id: oldId,
      name,
      kind,
      blob,
      createdAt: identity.now(),
      ...(role === undefined ? {} : { role }),
    });
  } catch {
    throw new WorkflowPackageValidationError();
  }
  return { oldId, asset, blob };
}

function importedRole(sourceRole: string, reservedKeys: Set<string>): string {
  const normalized = createAssetRole(sourceRole);
  if (!reservedKeys.has(assetRoleKey(normalized))) {
    reservedKeys.add(assetRoleKey(normalized));
    return normalized;
  }
  for (let suffix = 1n; ; suffix += 1n) {
    const ending =
      suffix === 1n ? ' (imported)' : ` (imported ${String(suffix)})`;
    if (Array.from(ending).length >= 64) {
      throw new WorkflowPackageValidationError(
        'Could not generate a unique imported Role.',
      );
    }
    const allowedBaseLength = 64 - Array.from(ending).length;
    const base = Array.from(normalized)
      .slice(0, allowedBaseLength)
      .join('')
      .trimEnd();
    const candidate = createAssetRole(`${base}${ending}`);
    const key = assetRoleKey(candidate);
    if (!reservedKeys.has(key)) {
      reservedKeys.add(key);
      return candidate;
    }
  }
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
    (envelope['version'] !== 1 && envelope['version'] !== 2) ||
    !Array.isArray(envelope['assets'])
  ) {
    throw new WorkflowPackageValidationError();
  }
  const version = envelope['version'];
  const sourceWorkflow = parseWorkflow(envelope['workflow'], version);
  const decodedAssets = envelope['assets'].map((value) =>
    parseAsset(value, version, options.assetPolicy, identity),
  );
  const assetsByOldId = new Map(
    decodedAssets.map((value) => [value.oldId, value]),
  );
  if (assetsByOldId.size !== decodedAssets.length) {
    throw new WorkflowPackageValidationError();
  }
  const references = packageReferences(sourceWorkflow);
  const assetsByRoleKey = new Map(
    decodedAssets.flatMap((value) =>
      value.asset.role === undefined
        ? []
        : [[assetRoleKey(value.asset.role), value] as const],
    ),
  );
  const roleCount = decodedAssets.filter(
    ({ asset }) => asset.role !== undefined,
  ).length;
  const matchedIds = new Set<string>();
  for (const [id, expectedKind] of references.direct) {
    const decodedAsset = assetsByOldId.get(id);
    if (decodedAsset?.asset.kind !== expectedKind) {
      throw new WorkflowPackageValidationError();
    }
    matchedIds.add(decodedAsset.oldId);
  }
  for (const [key, expectedKind] of references.roles) {
    const decodedAsset = assetsByRoleKey.get(key);
    if (decodedAsset?.asset.kind !== expectedKind) {
      throw new WorkflowPackageValidationError();
    }
    matchedIds.add(decodedAsset.oldId);
  }
  if (
    assetsByRoleKey.size !== roleCount ||
    matchedIds.size !== decodedAssets.length
  ) {
    throw new WorkflowPackageValidationError();
  }

  return unitOfWork.run(async () => {
    const localAssets = await assets.list();
    const reservedAssetIds = new Set(localAssets.map(({ id }) => String(id)));
    const reservedRoleKeys = new Set(
      localAssets.flatMap(({ role }) =>
        role === undefined ? [] : [assetRoleKey(role)],
      ),
    );
    const remappedAssets = decodedAssets.map(({ oldId, asset, blob }) => {
      const id = nextUniqueId(identity.createAssetId, reservedAssetIds);
      const role =
        asset.role === undefined
          ? undefined
          : importedRole(asset.role, reservedRoleKeys);
      return {
        oldId,
        sourceRoleKey:
          asset.role === undefined ? undefined : assetRoleKey(asset.role),
        asset: createAsset({
          ...asset,
          id,
          ...(role === undefined ? {} : { role }),
        }),
        blob,
      };
    });
    const remappedById = new Map(
      remappedAssets.map((value) => [value.oldId, value]),
    );
    const remappedByRole = new Map(
      remappedAssets.flatMap((value) =>
        value.sourceRoleKey === undefined
          ? []
          : [[value.sourceRoleKey, value] as const],
      ),
    );
    const rewriteReference = (
      reference: Workflow['phases'][number]['environment']['backgroundAsset'],
    ) => {
      if (reference === undefined) return undefined;
      if (reference.type === 'direct') {
        const mapped = remappedById.get(reference.assetId);
        return mapped === undefined
          ? undefined
          : { type: 'direct' as const, assetId: mapped.asset.id };
      }
      const mapped = remappedByRole.get(assetRoleKey(reference.role));
      return mapped?.asset.role === undefined
        ? undefined
        : { type: 'role' as const, role: mapped.asset.role };
    };
    const reservedWorkflowIds = new Set(
      (await workflows.list()).map((workflow) => String(workflow.id)),
    );
    const imported = createWorkflow({
      id: nextUniqueId(identity.createWorkflowId, reservedWorkflowIds),
      name: sourceWorkflow.name,
      phases: sourceWorkflow.phases.map((phase) => {
        const backgroundAsset = rewriteReference(
          phase.environment.backgroundAsset,
        );
        const audioAsset = rewriteReference(phase.environment.audioAsset);
        return {
          type: phase.type,
          durationSeconds: phase.durationSeconds,
          environment: {
            ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
            ...(audioAsset === undefined ? {} : { audioAsset }),
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
    for (const decodedAsset of remappedAssets) {
      await assets.save(decodedAsset.asset, decodedAsset.blob);
    }
    await workflows.save(imported);
    return imported;
  });
}
