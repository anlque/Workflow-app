import type { AssetReference } from '../domain/Environment';
import type { Environment } from '../domain/Environment';
import type { Workflow } from '../domain/Workflow';
import type { AssetReferenceResolver } from './AssetReferenceResolver';
import { mapWorkflowConfigurationEnvironments } from './workflowEnvironments';

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
  return mapWorkflowConfigurationEnvironments(workflow, (environment) =>
    resolveEnvironment(environment, resolver),
  );
}
