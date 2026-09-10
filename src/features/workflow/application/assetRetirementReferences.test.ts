import { describe, expect, test } from 'vitest';

import { createAsset } from '@/features/assets';

import { createWorkflow } from '../domain/createWorkflow';
import { InMemoryWorkflowRepository } from './testing/InMemoryWorkflowRepository';
import {
  removeOptionalWorkflowAssetReferences,
  replaceWorkflowAssetReferences,
  summarizeWorkflowAssetReferences,
} from './assetRetirementReferences';

const source = createAsset({
  id: 'source',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 1,
  role: 'Hero',
});
const replacement = createAsset({
  ...source,
  id: 'replacement',
  name: 'Meadow',
  createdAt: 2,
});

function workflow() {
  return createWorkflow({
    id: 'workflow',
    name: 'Deep work',
    phases: [
      {
        type: 'focus',
        durationSeconds: 60,
        environment: {
          backgroundAsset: { type: 'direct', assetId: source.id },
        },
      },
      {
        type: 'break',
        durationSeconds: 30,
        environment: { backgroundAsset: { type: 'role', role: 'Hero' } },
      },
    ],
  });
}

test('summarizes direct and Role references across all Phases once per Workflow', async () => {
  const repository = new InMemoryWorkflowRepository([workflow()]);
  await expect(
    summarizeWorkflowAssetReferences(repository, source),
  ).resolves.toEqual([
    {
      workflowId: 'workflow',
      workflowName: 'Deep work',
      directReferenceCount: 1,
      roleReferenceCount: 1,
      optionalReferenceCount: 2,
      requiredReferenceCount: 0,
    },
  ]);
});

describe('Workflow Asset retirement patches', () => {
  test('replaces direct IDs while preserving Role references', async () => {
    const repository = new InMemoryWorkflowRepository([workflow()]);
    await replaceWorkflowAssetReferences(repository, source, replacement);
    const saved = (await repository.list())[0];
    expect(saved).toBeDefined();
    if (saved === undefined) return;
    expect(saved.phases[0].environment.backgroundAsset).toEqual({
      type: 'direct',
      assetId: replacement.id,
    });
    expect(saved.phases[1]?.environment.backgroundAsset).toEqual({
      type: 'role',
      role: 'Hero',
    });
  });

  test('removes every optional direct and Role reference', async () => {
    const repository = new InMemoryWorkflowRepository([workflow()]);
    await removeOptionalWorkflowAssetReferences(repository, source);
    const saved = (await repository.list())[0];
    expect(saved).toBeDefined();
    if (saved === undefined) return;
    expect(saved.phases[0].environment.backgroundAsset).toBeUndefined();
    expect(saved.phases[1]?.environment.backgroundAsset).toBeUndefined();
  });
});
