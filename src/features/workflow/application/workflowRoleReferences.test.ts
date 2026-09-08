import { describe, expect, test } from 'vitest';

import { createAssetRole } from '@/features/assets';

import { createWorkflow } from '../domain/createWorkflow';
import { InMemoryWorkflowRepository } from './testing/InMemoryWorkflowRepository';
import {
  renameWorkflowRoleReferences,
  summarizeWorkflowRoleReferences,
} from './workflowRoleReferences';

const role = createAssetRole('Ambient');

describe('Workflow Role references', () => {
  test('summarizes distinct Workflows and every expected kind', async () => {
    const repository = new InMemoryWorkflowRepository([
      createWorkflow({
        id: 'one',
        name: 'One',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: {
              audioAsset: { type: 'role', role: 'Ambient' },
            },
          },
          {
            type: 'break',
            durationSeconds: 30,
            environment: {
              audioAsset: { type: 'role', role: 'AMBIENT' },
            },
          },
        ],
      }),
      createWorkflow({
        id: 'two',
        name: 'Two',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: {
              backgroundAsset: { type: 'role', role: 'ambient' },
              audioAsset: { type: 'direct', assetId: 'direct' },
            },
          },
        ],
      }),
    ]);

    await expect(
      summarizeWorkflowRoleReferences(repository, role),
    ).resolves.toEqual({
      workflowCount: 2,
      expectedKinds: ['image', 'audio'],
    });
  });

  test('renames every matching Role while preserving direct references', async () => {
    const source = createWorkflow({
      id: 'one',
      name: 'One',
      phases: [
        {
          type: 'focus',
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'direct', assetId: 'direct' },
            audioAsset: { type: 'role', role: 'AMBIENT' },
          },
        },
        {
          type: 'break',
          durationSeconds: 30,
          environment: {
            audioAsset: { type: 'role', role: 'Ambient' },
          },
        },
      ],
    });
    const untouched = createWorkflow({
      id: 'two',
      name: 'Two',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    const repository = new InMemoryWorkflowRepository([source, untouched]);

    await renameWorkflowRoleReferences(
      repository,
      role,
      createAssetRole('Deep Work'),
    );

    const [renamed, stillUntouched] = await repository.list();
    expect(renamed?.phases[0].environment.backgroundAsset).toEqual(
      source.phases[0].environment.backgroundAsset,
    );
    expect(
      renamed?.phases.map((phase) => phase.environment.audioAsset),
    ).toEqual([
      { type: 'role', role: 'Deep Work' },
      { type: 'role', role: 'Deep Work' },
    ]);
    expect(stillUntouched).toBe(untouched);
  });
});
