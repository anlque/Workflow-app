import { describe, expect, test, vi } from 'vitest';

import { createAssetId } from '@/features/assets';

import { createWorkflow } from '../domain/createWorkflow';
import type { AssetReferenceResolver } from './AssetReferenceResolver';
import { resolveWorkflowAssetReferences } from './resolveWorkflowAssetReferences';

describe('resolveWorkflowAssetReferences', () => {
  test('resolves every Role with the Environment expected kind', async () => {
    const resolve = vi.fn<AssetReferenceResolver['resolve']>((role, kind) =>
      Promise.resolve(createAssetId(`${kind}-${role}`)),
    );
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Roles',
      phases: [
        {
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
    expect(firstPhase.environment).toEqual({
      backgroundAsset: { type: 'direct', assetId: 'image-Backdrop' },
      audioAsset: { type: 'direct', assetId: 'audio-Ambient' },
    });
    expect(secondPhase.environment.backgroundAsset).toEqual(
      sourceSecondPhase.environment.backgroundAsset,
    );
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
});
