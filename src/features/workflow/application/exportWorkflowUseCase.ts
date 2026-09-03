import type { AssetRepository } from '@/features/assets';
import type { AssetId } from '@/shared';

import type { Workflow } from '../domain/Workflow';
import {
  WorkflowPackageValidationError,
  type WorkflowPackageV1,
} from './WorkflowPackage';
import { serializeWorkflow } from './workflowPackageMapping';

function referencedAssetIds(workflow: Workflow): readonly AssetId[] {
  return [
    ...new Set(
      workflow.phases.flatMap(({ environment }) => [
        ...(environment.backgroundAssetId === undefined
          ? []
          : [environment.backgroundAssetId]),
        ...(environment.audioAssetId === undefined
          ? []
          : [environment.audioAssetId]),
      ]),
    ),
  ].sort();
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
  const assetsById = new Map(allAssets.map((asset) => [asset.id, asset]));
  const encodedAssets = await Promise.all(
    referencedAssetIds(workflow).map(async (id) => {
      const asset = assetsById.get(id);
      if (asset === undefined) {
        throw new WorkflowPackageValidationError(
          `Referenced Asset ${id} was not found.`,
        );
      }
      const blob = await assets.getBlob(asset.id);
      if (blob === null) {
        throw new WorkflowPackageValidationError(
          `Referenced Asset ${id} has no content.`,
        );
      }
      return {
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        dataBase64: encodeBase64(new Uint8Array(await blob.arrayBuffer())),
      };
    }),
  );
  const envelope: WorkflowPackageV1 = {
    kind: 'locusora/workflow',
    version: 1,
    workflow: serializeWorkflow(workflow),
    assets: encodedAssets,
  };
  return JSON.stringify(envelope);
}
