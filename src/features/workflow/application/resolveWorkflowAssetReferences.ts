import { createWorkflow } from '../domain/createWorkflow';
import type { AssetReference } from '../domain/Environment';
import type { Workflow } from '../domain/Workflow';
import type { AssetReferenceResolver } from './AssetReferenceResolver';

async function resolveReference(
  reference: AssetReference | undefined,
  expectedKind: 'image' | 'audio',
  resolver: AssetReferenceResolver,
) {
  if (reference === undefined || reference.type === 'direct') return reference;
  return {
    type: 'direct' as const,
    assetId: await resolver.resolve(reference.role, expectedKind),
  };
}

export async function resolveWorkflowAssetReferences(
  workflow: Workflow,
  resolver: AssetReferenceResolver,
): Promise<Workflow> {
  const phases = await Promise.all(
    workflow.phases.map(async (phase) => {
      const backgroundAsset = await resolveReference(
        phase.environment.backgroundAsset,
        'image',
        resolver,
      );
      const audioAsset = await resolveReference(
        phase.environment.audioAsset,
        'audio',
        resolver,
      );
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
  );
  return createWorkflow({
    id: workflow.id,
    name: workflow.name,
    phases,
    ...(workflow.rewardDice === undefined
      ? {}
      : {
          rewardDice: {
            schedule: workflow.rewardDice.schedule,
            rerolls: workflow.rewardDice.rerolls,
            sides: workflow.rewardDice.sides.map((side) => ({
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
}
