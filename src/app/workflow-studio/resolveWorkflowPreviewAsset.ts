import { assetRoleKey, type Asset } from '@/features/assets';
import type { Workflow } from '@/features/workflow';

export function resolveWorkflowPreviewAsset(
  workflow: Workflow,
  assets: readonly Asset[],
): Asset | undefined {
  const environments = [
    ...workflow.phases.map(({ environment }) => environment),
    ...(workflow.rewardDice?.sides.flatMap(({ bonusPhase }) =>
      bonusPhase === undefined ? [] : [bonusPhase.environment],
    ) ?? []),
  ];
  for (const environment of environments) {
    const reference = environment.backgroundAsset;
    if (reference === undefined) continue;
    const asset =
      reference.type === 'direct'
        ? assets.find(({ id }) => id === reference.assetId)
        : assets.find(
            ({ role }) =>
              role !== undefined &&
              assetRoleKey(role) === assetRoleKey(reference.role),
          );
    if (asset?.kind === 'image') return asset;
  }
  return undefined;
}
