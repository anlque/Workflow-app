import { describe, expect, test, vi } from 'vitest';

import { createAssetId } from '@/features/assets';

import { createWorkflow } from '../domain/createWorkflow';
import type { AssetReferenceResolver } from './AssetReferenceResolver';
import { resolveWorkflowAssetReferences } from './resolveWorkflowAssetReferences';

describe('resolveWorkflowAssetReferences', () => {
  test('resolves each Quick source Environment once and preserves raw configuration', async () => {
    const resolve = vi.fn<AssetReferenceResolver['resolve']>((role, kind) =>
      Promise.resolve(createAssetId(`${kind}-${role}`)),
    );
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick-roles',
      name: 'Quick roles',
      configuration: {
        cycleCount: 4,
        focus: {
          durationSeconds: 1_500,
          environment: {
            backgroundAsset: { type: 'role', role: 'Focus image' },
          },
        },
        shortBreak: {
          durationSeconds: 300,
          environment: { audioAsset: { type: 'role', role: 'Break audio' } },
        },
        longBreak: {
          durationSeconds: 900,
          environment: {
            backgroundAsset: { type: 'role', role: 'Long image' },
          },
          frequency: 2,
        },
        rewardDice: {
          frequency: 2,
          sides: [
            { icon: 'a', title: 'A', weight: 2 },
            { icon: 'b', title: 'B', weight: 4 },
          ],
        },
      },
    });
    const resolved = await resolveWorkflowAssetReferences(workflow, {
      resolve,
    });
    expect(resolve).toHaveBeenCalledTimes(3);
    expect(resolved.mode).toBe('quick');
    if (resolved.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    expect(
      resolved.configuration.rewardDice?.sides.map(({ weight }) => weight),
    ).toEqual([2, 4]);
    expect(
      resolved.phases.every(
        ({ environment }) =>
          environment.backgroundAsset?.type !== 'role' &&
          environment.audioAsset?.type !== 'role',
      ),
    ).toBe(true);
  });

  test('resolves every Role with the Environment expected kind', async () => {
    const resolve = vi.fn<AssetReferenceResolver['resolve']>((role, kind) =>
      Promise.resolve(createAssetId(`${kind}-${role}`)),
    );
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Roles',
      phases: [
        {
          name: 'Writing',
          type: 'focus',
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'role', role: 'Backdrop' },
            audioAsset: { type: 'role', role: 'Ambient' },
          },
        },
        {
          type: 'break',
          durationSeconds: 30,
          environment: {
            backgroundAsset: { type: 'direct', assetId: 'direct-image' },
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
              name: 'Tea break',
              durationSeconds: 300,
              environment: {
                backgroundAsset: { type: 'role', role: 'Bonus backdrop' },
                audioAsset: { type: 'role', role: 'Bonus ambient' },
              },
            },
          },
          { icon: 'walk', title: 'Walk', availability: 'late' },
        ],
      },
    });

    const resolved = await resolveWorkflowAssetReferences(workflow, {
      resolve,
    });
    const firstPhase = resolved.phases.at(0);
    const secondPhase = resolved.phases.at(1);
    const sourceSecondPhase = workflow.phases.at(1);
    if (
      firstPhase === undefined ||
      secondPhase === undefined ||
      sourceSecondPhase === undefined
    ) {
      throw new Error('Expected two resolved Phases.');
    }

    expect(resolve).toHaveBeenNthCalledWith(1, 'Backdrop', 'image');
    expect(resolve).toHaveBeenNthCalledWith(2, 'Ambient', 'audio');
    expect(resolve).toHaveBeenNthCalledWith(3, 'Bonus backdrop', 'image');
    expect(resolve).toHaveBeenNthCalledWith(4, 'Bonus ambient', 'audio');
    expect(firstPhase.environment).toEqual({
      backgroundAsset: { type: 'direct', assetId: 'image-Backdrop' },
      audioAsset: { type: 'direct', assetId: 'audio-Ambient' },
    });
    expect(firstPhase.name).toBe('Writing');
    expect(secondPhase.environment.backgroundAsset).toEqual(
      sourceSecondPhase.environment.backgroundAsset,
    );
    expect(resolved.rewardDice?.schedule).toEqual({
      type: 'custom',
      phaseIndexes: [1],
    });
    expect(
      resolved.rewardDice?.sides.map(({ availability }) => availability),
    ).toEqual(['early', 'late']);
    expect(resolved.rewardDice?.sides[0]?.bonusPhase?.environment).toEqual({
      backgroundAsset: { type: 'direct', assetId: 'image-Bonus backdrop' },
      audioAsset: { type: 'direct', assetId: 'audio-Bonus ambient' },
    });
  });

  test('propagates resolution failure without returning a partial Workflow', async () => {
    const failure = new Error('unresolved');
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Roles',
      phases: [
        {
          type: 'focus',
          durationSeconds: 60,
          environment: { audioAsset: { type: 'role', role: 'Missing' } },
        },
      ],
    });

    await expect(
      resolveWorkflowAssetReferences(workflow, {
        resolve: () => Promise.reject(failure),
      }),
    ).rejects.toBe(failure);
  });

  test('resolves every repeated Role occurrence and preserves direct references', async () => {
    const resolve = vi.fn<AssetReferenceResolver['resolve']>(() =>
      Promise.resolve(createAssetId('audio-ambient')),
    );
    const workflow = createWorkflow({
      id: 'workflow-repeated-role',
      name: 'Repeated Role',
      phases: [
        {
          type: 'focus',
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'direct', assetId: 'image-direct' },
            audioAsset: { type: 'role', role: 'Ambient' },
          },
        },
        {
          type: 'break',
          durationSeconds: 30,
          environment: { audioAsset: { type: 'role', role: 'Ambient' } },
        },
      ],
    });

    const resolved = await resolveWorkflowAssetReferences(workflow, {
      resolve,
    });

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenNthCalledWith(1, 'Ambient', 'audio');
    expect(resolve).toHaveBeenNthCalledWith(2, 'Ambient', 'audio');
    expect(resolved.phases[0].environment.backgroundAsset).toEqual(
      workflow.phases[0].environment.backgroundAsset,
    );
    expect(
      resolved.phases.map(({ environment }) => environment.audioAsset),
    ).toEqual([
      { type: 'direct', assetId: 'audio-ambient' },
      { type: 'direct', assetId: 'audio-ambient' },
    ]);
  });
});
