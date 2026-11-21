import { describe, expect, test } from 'vitest';

import { createAsset } from '@/features/assets';
import { createWorkflow } from '@/features/workflow';

import { resolveWorkflowPreviewAsset } from './resolveWorkflowPreviewAsset';

const image = createAsset({
  id: 'image',
  name: 'Image',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 1,
  role: 'Backdrop',
});
const audio = createAsset({
  id: 'audio',
  name: 'Audio',
  kind: 'audio',
  mimeType: 'audio/mpeg',
  byteSize: 1,
  createdAt: 1,
  role: 'Soundscape',
});

function workflowWithBackgrounds(...backgroundAsset: readonly object[]) {
  return createWorkflow({
    id: 'workflow',
    name: 'Workflow',
    phases: backgroundAsset.map((reference, index) => ({
      type: index % 2 === 0 ? ('focus' as const) : ('break' as const),
      durationSeconds: 60,
      environment: { backgroundAsset: reference as never },
    })),
  });
}

describe('resolveWorkflowPreviewAsset', () => {
  test('resolves the first available direct image and skips missing or audio Assets', () => {
    const workflow = workflowWithBackgrounds(
      { type: 'direct', assetId: 'missing' },
      { type: 'direct', assetId: audio.id },
      { type: 'direct', assetId: image.id },
    );

    expect(resolveWorkflowPreviewAsset(workflow, [audio, image])).toBe(image);
  });

  test('resolves Role references canonically and ignores incompatible Roles', () => {
    const workflow = workflowWithBackgrounds(
      { type: 'role', role: ' soundscape ' },
      { type: 'role', role: 'BACKDROP' },
    );

    expect(resolveWorkflowPreviewAsset(workflow, [audio, image])).toBe(image);
  });

  test('returns undefined when no compatible background image is available', () => {
    const workflow = workflowWithBackgrounds({
      type: 'direct',
      assetId: audio.id,
    });

    expect(resolveWorkflowPreviewAsset(workflow, [audio])).toBeUndefined();
  });

  test('continues into Bonus Phase environments after ordinary Phases', () => {
    const workflow = createWorkflow({
      id: 'bonus-workflow',
      name: 'Bonus workflow',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'image',
            title: 'Image bonus',
            bonusPhase: {
              name: 'Bonus',
              durationSeconds: 60,
              environment: {
                backgroundAsset: { type: 'direct', assetId: image.id },
              },
            },
          },
          { icon: 'plain', title: 'Plain reward' },
        ],
      },
    });

    expect(resolveWorkflowPreviewAsset(workflow, [image])).toBe(image);
  });
});
