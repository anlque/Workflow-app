import {
  assetRoleKey,
  type Asset,
  type AssetRetirementOccurrence,
} from '@/features/assets';

import { createWorkflow } from '../domain/createWorkflow';
import type { AssetReference, EnvironmentInput } from '../domain/Environment';
import type { Workflow } from '../domain/Workflow';
import type { WorkflowRepository } from './WorkflowRepository';

export type WorkflowAssetRetirementUsage = Readonly<{
  workflowId: Workflow['id'];
  workflowName: string;
  occurrences: readonly AssetRetirementOccurrence[];
}>;

function referenceKind(reference: AssetReference | undefined, source: Asset) {
  if (reference?.type === 'direct' && reference.assetId === source.id)
    return 'direct';
  if (
    reference?.type === 'role' &&
    source.role !== undefined &&
    assetRoleKey(reference.role) === assetRoleKey(source.role)
  )
    return 'role';
  return null;
}

function occurrences(workflow: Workflow, source: Asset) {
  const values: AssetRetirementOccurrence[] = [];
  workflow.phases.forEach(({ environment }, phaseIndex) => {
    const references = [
      {
        location: 'background' as const,
        reference: environment.backgroundAsset,
      },
      { location: 'audio' as const, reference: environment.audioAsset },
    ];
    references.forEach(({ location, reference }) => {
      const referenceMode = referenceKind(reference, source);
      if (referenceMode !== null) {
        values.push({ phaseIndex, location, referenceMode, optional: true });
      }
    });
  });
  return values;
}

export async function summarizeWorkflowAssetReferences(
  repository: WorkflowRepository,
  source: Asset,
): Promise<readonly WorkflowAssetRetirementUsage[]> {
  return (await repository.list()).flatMap((workflow) => {
    const values = occurrences(workflow, source);
    return values.length === 0
      ? []
      : [
          {
            workflowId: workflow.id,
            workflowName: workflow.name,
            occurrences: values,
          },
        ];
  });
}

function copyWorkflow(
  workflow: Workflow,
  transform: (
    reference: AssetReference | undefined,
  ) => AssetReference | undefined,
): Workflow {
  return createWorkflow({
    id: workflow.id,
    name: workflow.name,
    phases: workflow.phases.map((phase) => {
      const backgroundAsset = transform(phase.environment.backgroundAsset);
      const audioAsset = transform(phase.environment.audioAsset);
      const environment: EnvironmentInput = {
        ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
        ...(audioAsset === undefined ? {} : { audioAsset }),
        ...(phase.environment.backgroundColor === undefined
          ? {}
          : { backgroundColor: phase.environment.backgroundColor }),
      };
      return {
        type: phase.type,
        durationSeconds: phase.durationSeconds,
        environment,
      };
    }),
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

async function patch(
  repository: WorkflowRepository,
  source: Asset,
  transform: (
    reference: AssetReference | undefined,
  ) => AssetReference | undefined,
): Promise<void> {
  for (const workflow of await repository.list()) {
    if (occurrences(workflow, source).length > 0)
      await repository.save(copyWorkflow(workflow, transform));
  }
}

export function replaceWorkflowAssetReferences(
  repository: WorkflowRepository,
  source: Asset,
  replacement: Asset,
): Promise<void> {
  return patch(repository, source, (reference) =>
    referenceKind(reference, source) === 'direct'
      ? { type: 'direct', assetId: replacement.id }
      : reference,
  );
}

export function removeOptionalWorkflowAssetReferences(
  repository: WorkflowRepository,
  source: Asset,
): Promise<void> {
  return patch(repository, source, (reference) =>
    referenceKind(reference, source) === null ? reference : undefined,
  );
}
