import { createWorkflow } from '../domain/createWorkflow';
import type { AssetReference } from '../domain/Environment';
import type { Environment } from '../domain/Environment';
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

async function resolveEnvironment(
  environment: Environment,
  resolver: AssetReferenceResolver,
) {
  const backgroundAsset = await resolveReference(
    environment.backgroundAsset,
    'image',
    resolver,
  );
  const audioAsset = await resolveReference(
    environment.audioAsset,
    'audio',
    resolver,
  );
  return {
    ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
    ...(audioAsset === undefined ? {} : { audioAsset }),
    ...(environment.backgroundColor === undefined
      ? {}
      : { backgroundColor: environment.backgroundColor }),
  };
}

export async function resolveWorkflowAssetReferences(
  workflow: Workflow,
  resolver: AssetReferenceResolver,
): Promise<Workflow> {
  const phases = await Promise.all(
    workflow.phases.map(async (phase) => {
      return {
        type: phase.type,
        durationSeconds: phase.durationSeconds,
        environment: await resolveEnvironment(phase.environment, resolver),
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
            sides: await Promise.all(
              workflow.rewardDice.sides.map(async (side) => ({
                icon: side.icon,
                title: side.title,
                ...(side.description === undefined
                  ? {}
                  : { description: side.description }),
                availability: side.availability,
                weight: side.probability,
                ...(side.bonusPhase === undefined
                  ? {}
                  : {
                      bonusPhase: {
                        name: side.bonusPhase.name,
                        durationSeconds: side.bonusPhase.durationSeconds,
                        environment: await resolveEnvironment(
                          side.bonusPhase.environment,
                          resolver,
                        ),
                      },
                    }),
              })),
            ),
          },
        }),
  });
}
