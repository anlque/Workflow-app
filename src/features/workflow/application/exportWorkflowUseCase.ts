import {
  assetRoleKey,
  type Asset,
  type AssetRepository,
} from '@/features/assets';
import type { AssetId } from '@/shared';

import type { Workflow } from '../domain/Workflow';
import {
  WorkflowPackageValidationError,
  type WorkflowPackageV2,
} from './WorkflowPackage';
import { serializeWorkflow } from './workflowPackageMapping';

function referencedAssets(
  workflow: Workflow,
  assets: readonly Asset[],
): readonly Asset[] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const byRole = new Map(
    assets.flatMap((asset) =>
      asset.role === undefined
        ? []
        : [[assetRoleKey(asset.role), asset] as const],
    ),
  );
  const selected = new Map<AssetId, Asset>();
  for (const { environment } of workflow.phases) {
    for (const [reference, expectedKind] of [
      [environment.backgroundAsset, 'image'],
      [environment.audioAsset, 'audio'],
    ] as const) {
      if (reference === undefined) continue;
      const asset =
        reference.type === 'direct'
          ? byId.get(reference.assetId)
          : byRole.get(assetRoleKey(reference.role));
      if (asset === undefined) {
        throw new WorkflowPackageValidationError(
          'Referenced Asset was not found.',
        );
      }
      if (asset.kind !== expectedKind) {
        throw new WorkflowPackageValidationError(
          'Referenced Asset has the wrong kind.',
        );
      }
      selected.set(asset.id, asset);
    }
  }
  return [...selected.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function exportWorkflowUseCase(
  workflow: Workflow,
  assets: AssetRepository,
): Promise<string> {
  const allAssets = await assets.list();
  const encodedAssets = await Promise.all(
    referencedAssets(workflow, allAssets).map(async (asset) => {
      const blob = await assets.getBlob(asset.id);
      if (blob === null) {
        throw new WorkflowPackageValidationError(
          `Referenced Asset ${asset.id} has no content.`,
        );
      }
      return {
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        ...(asset.role === undefined ? {} : { role: asset.role }),
        dataBase64: encodeBase64(new Uint8Array(await blob.arrayBuffer())),
      };
    }),
  );
  const envelope: WorkflowPackageV2 = {
    kind: 'locusora/workflow',
    version: 2,
    workflow: serializeWorkflow(workflow),
    assets: encodedAssets,
  };
  return JSON.stringify(envelope);
}
