import { describe, expect, test } from 'vitest';

import { createAsset } from '@/features/assets';
import { createWorkflow } from '@/features/workflow';

import { createAssetUsageSummaries } from './createAssetUsageSummaries';

describe('createAssetUsageSummaries', () => {
  test('counts direct and canonical Role references across Detailed, Quick and Bonus environments', () => {
    const scene = createAsset({
      id: 'scene',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
      role: 'Hero Scene',
    });
    const ambient = createAsset({
      id: 'ambient',
      name: 'Rain',
      kind: 'audio',
      mimeType: 'audio/mpeg',
      byteSize: 1,
      createdAt: 1,
      role: 'Ambient',
    });
    const unused = createAsset({
      id: 'unused',
      name: 'Unused',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
    });
    const detailed = createWorkflow({
      id: 'detailed',
      name: 'Deep work',
      phases: [
        {
          type: 'focus',
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'direct', assetId: scene.id },
            audioAsset: { type: 'role', role: 'AMBIENT' },
          },
        },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'tea',
            title: 'Tea',
            bonusPhase: {
              name: 'Bonus',
              durationSeconds: 60,
              environment: {
                backgroundAsset: { type: 'role', role: 'hero scene' },
              },
            },
          },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const quick = createWorkflow({
      mode: 'quick',
      id: 'quick',
      name: 'Quick focus',
      configuration: {
        cycleCount: 2,
        focus: {
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'role', role: 'Hero Scene' },
          },
        },
        shortBreak: {
          durationSeconds: 30,
          environment: {
            audioAsset: { type: 'direct', assetId: ambient.id },
          },
        },
      },
    });

    const summaries = createAssetUsageSummaries(
      [detailed, quick],
      [scene, ambient, unused],
    );

    expect(summaries.get(scene.id)).toEqual({
      workflowCount: 2,
      workflows: [
        { id: detailed.id, name: 'Deep work' },
        { id: quick.id, name: 'Quick focus' },
      ],
      occurrences: 3,
    });
    expect(summaries.get(ambient.id)).toEqual({
      workflowCount: 2,
      workflows: [
        { id: detailed.id, name: 'Deep work' },
        { id: quick.id, name: 'Quick focus' },
      ],
      occurrences: 2,
    });
    expect(summaries.get(unused.id)).toEqual({
      workflowCount: 0,
      workflows: [],
      occurrences: 0,
    });
  });

  test('keeps same-name Workflows distinct by ID', () => {
    const background = createAsset({
      id: 'background',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
    });
    const workflows = ['first', 'second'].map((id) =>
      createWorkflow({
        id,
        name: 'Deep work',
        phases: [
          {
            type: 'focus',
            durationSeconds: 60,
            environment: {
              backgroundAsset: { type: 'direct', assetId: background.id },
            },
          },
        ],
      }),
    );

    expect(
      createAssetUsageSummaries(workflows, [background]).get(background.id),
    ).toEqual({
      workflowCount: 2,
      workflows: [
        { id: workflows[0]?.id, name: 'Deep work' },
        { id: workflows[1]?.id, name: 'Deep work' },
      ],
      occurrences: 2,
    });
  });
});
