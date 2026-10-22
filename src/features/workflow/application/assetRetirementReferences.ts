import {
  assetRoleKey,
  type Asset,
  type AssetRetirementOccurrence,
} from '@/features/assets';

import type { AssetReference, EnvironmentInput } from '../domain/Environment';
import type { Workflow } from '../domain/Workflow';
import type { WorkflowRepository } from './WorkflowRepository';
import {
  listWorkflowConfigurationEnvironments,
  mapWorkflowConfigurationEnvironments,
} from './workflowEnvironments';

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
  listWorkflowConfigurationEnvironments(workflow).forEach(
    ({ environment, location: owner }) => {
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
          values.push({
            ...owner,
            location,
            referenceMode,
            optional: true,
          });
        }
      });
    },
  );
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

async function copyWorkflow(
  workflow: Workflow,
  transform: (
    reference: AssetReference | undefined,
  ) => AssetReference | undefined,
): Promise<Workflow> {
  return mapWorkflowConfigurationEnvironments(workflow, (environment) =>
    copyEnvironment(environment, transform),
  );
}

function copyEnvironment(
  source: Workflow['phases'][number]['environment'],
  transform: (
    reference: AssetReference | undefined,
  ) => AssetReference | undefined,
): EnvironmentInput {
  const backgroundAsset = transform(source.backgroundAsset);
  const audioAsset = transform(source.audioAsset);
  return {
    ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
    ...(audioAsset === undefined ? {} : { audioAsset }),
    ...(source.backgroundColor === undefined
      ? {}
      : { backgroundColor: source.backgroundColor }),
  };
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
      await repository.save(await copyWorkflow(workflow, transform));
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
