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
  test('summarizes and renames Quick source Roles without converting mode', async () => {
    const quick = createWorkflow({
      mode: 'quick',
      id: 'quick',
      name: 'Quick',
      configuration: {
        cycleCount: 3,
        focus: {
          durationSeconds: 1_500,
          environment: { audioAsset: { type: 'role', role: 'Ambient' } },
        },
        shortBreak: {
          durationSeconds: 300,
          environment: { audioAsset: { type: 'role', role: 'AMBIENT' } },
        },
      },
    });
    const repository = new InMemoryWorkflowRepository([quick]);
    await expect(
      summarizeWorkflowRoleReferences(repository, role),
    ).resolves.toEqual({ workflowCount: 1, expectedKinds: ['audio'] });
    await renameWorkflowRoleReferences(
      repository,
      role,
      createAssetRole('New ambience'),
    );
    const renamed = (await repository.list())[0];
    expect(renamed?.mode).toBe('quick');
    if (renamed?.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    expect(renamed.configuration.focus.environment.audioAsset).toEqual({
      type: 'role',
      role: 'New ambience',
    });
    expect(renamed.configuration.shortBreak.environment.audioAsset).toEqual({
      type: 'role',
      role: 'New ambience',
    });
  });

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
          name: 'Writing',
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
      rewardDice: {
        schedule: { type: 'custom', phaseIndexes: [1] },
        sides: [
          {
            icon: 'tea',
            title: 'Tea',
            availability: 'early',
            bonusPhase: {
              name: 'Bonus',
              durationSeconds: 300,
              environment: {
                backgroundAsset: { type: 'role', role: 'AMBIENT' },
              },
            },
          },
          { icon: 'walk', title: 'Walk', availability: 'late' },
        ],
      },
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
    expect(renamed?.phases[0]?.name).toBe('Writing');
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
    expect(renamed?.rewardDice?.schedule).toEqual({
      type: 'custom',
      phaseIndexes: [1],
    });
    expect(
      renamed?.rewardDice?.sides.map(({ availability }) => availability),
    ).toEqual(['early', 'late']);
    expect(
      renamed?.rewardDice?.sides[0]?.bonusPhase?.environment.backgroundAsset,
    ).toEqual({ type: 'role', role: 'Deep Work' });
  });
});
