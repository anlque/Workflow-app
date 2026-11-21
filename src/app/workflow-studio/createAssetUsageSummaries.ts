import {
  assetRoleKey,
  type Asset,
  type AssetId,
  type AssetKind,
} from '@/features/assets';
import {
  listWorkflowConfigurationEnvironments,
  type AssetReference,
  type Workflow,
} from '@/features/workflow';
import type { AssetUsageSummary } from '@/features/assets/studio';

function resolveReference(
  reference: AssetReference | undefined,
  expectedKind: AssetKind,
  assets: readonly Asset[],
): Asset | undefined {
  if (reference === undefined) return undefined;
  if (reference.type === 'direct') {
    return assets.find(
      ({ id, kind }) => id === reference.assetId && kind === expectedKind,
    );
  }
  const key = assetRoleKey(reference.role);
  return assets.find(
    ({ role, kind }) =>
      kind === expectedKind && role !== undefined && assetRoleKey(role) === key,
  );
}

export function createAssetUsageSummaries(
  workflows: readonly Workflow[],
  assets: readonly Asset[],
): ReadonlyMap<AssetId, AssetUsageSummary> {
  const mutable = new Map<
    AssetId,
    {
      workflowIds: Set<string>;
      workflows: Map<string, string>;
      occurrences: number;
    }
  >(
    assets.map(({ id }) => [
      id,
      { workflowIds: new Set(), workflows: new Map(), occurrences: 0 },
    ]),
  );

  for (const workflow of workflows) {
    for (const { environment } of listWorkflowConfigurationEnvironments(
      workflow,
    )) {
      for (const [reference, kind] of [
        [environment.backgroundAsset, 'image'],
        [environment.audioAsset, 'audio'],
      ] as const) {
        const asset = resolveReference(reference, kind, assets);
        if (asset === undefined) continue;
        const summary = mutable.get(asset.id);
        if (summary === undefined) continue;
        summary.workflowIds.add(workflow.id);
        summary.workflows.set(workflow.id, workflow.name);
        summary.occurrences += 1;
      }
    }
  }

  return new Map(
    [...mutable].map(([id, summary]) => [
      id,
      {
        workflowCount: summary.workflowIds.size,
        workflows: [...summary.workflows].map(([workflowId, name]) => ({
          id: workflowId,
          name,
        })),
        occurrences: summary.occurrences,
      },
    ]),
  );
}
