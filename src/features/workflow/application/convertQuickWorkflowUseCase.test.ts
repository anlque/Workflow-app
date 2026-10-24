import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '../domain/createWorkflow';
import { createWorkflowId } from '../domain/Workflow';
import type { QuickWorkflow } from '../domain/QuickWorkflow';
import type { WorkflowConversionUnitOfWork } from './WorkflowConversionUnitOfWork';
import { convertQuickWorkflowUseCase } from './convertQuickWorkflowUseCase';
import { InMemoryWorkflowRepository } from './testing/InMemoryWorkflowRepository';

function quick(id = 'quick', name = 'Focus rhythm'): QuickWorkflow {
  const workflow = createWorkflow({
    mode: 'quick',
    id,
    name,
    configuration: {
      cycleCount: 2,
      focus: {
        durationSeconds: 1_500,
        environment: {
          backgroundAsset: { type: 'role', role: 'Focus image' },
        },
      },
      shortBreak: {
        durationSeconds: 300,
        environment: {
          audioAsset: { type: 'direct', assetId: 'break-audio' },
        },
      },
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea', weight: 1 },
          { icon: 'walk', title: 'Walk', weight: 3 },
        ],
      },
    },
  });
  if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow.');
  return workflow;
}

function quickWithWeights(weights: readonly (number | undefined)[]) {
  const source = quick();
  const workflow = createWorkflow({
    mode: 'quick',
    id: source.id,
    name: source.name,
    configuration: {
      ...source.configuration,
      rewardDice: {
        frequency: 1,
        sides: weights.map((weight, index) => ({
          icon: `icon-${String(index)}`,
          title: `Reward ${String(index + 1)}`,
          ...(weight === undefined ? {} : { weight }),
        })),
      },
    },
  });
  if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow.');
  return workflow;
}

function detailed(id: string, name: string) {
  return createWorkflow({
    mode: 'detailed',
    id,
    name,
    phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
  });
}

function memoryUnitOfWork(
  repository: InMemoryWorkflowRepository,
): WorkflowConversionUnitOfWork {
  return {
    async commit({ replacement, copy, order }) {
      await repository.save(replacement);
      if (copy !== undefined) await repository.save(copy);
      await repository.replaceOrder(order);
    },
  };
}

describe('convertQuickWorkflowUseCase', () => {
  test('materializes an executable-equivalent Detailed replacement at the beginning of its group', async () => {
    const firstDetailed = detailed('detailed-1', 'Detailed one');
    const source = quick();
    const secondQuick = quick('quick-2', 'Second quick');
    const repository = new InMemoryWorkflowRepository([
      secondQuick,
      firstDetailed,
      source,
    ]);

    const result = await convertQuickWorkflowUseCase(
      repository,
      memoryUnitOfWork(repository),
      {
        sourceId: source.id,
        input: {
          mode: 'quick',
          id: source.id,
          name: source.name,
          configuration: source.configuration,
        },
      },
    );

    expect(result.converted).toMatchObject({
      id: source.id,
      name: source.name,
      mode: 'detailed',
    });
    expect(result.converted.phases).toEqual(source.phases);
    expect(result.converted.rewardDice).toEqual(source.rewardDice);
    await expect(repository.list()).resolves.toEqual([
      secondQuick,
      result.converted,
      firstDetailed,
    ]);
  });

  test('keeps a collision-safe Quick copy in the source slot', async () => {
    const source = quick();
    const existingName = quick('quick-2', 'Focus rhythm (Quick copy)');
    const repository = new InMemoryWorkflowRepository([source, existingName]);

    const result = await convertQuickWorkflowUseCase(
      repository,
      memoryUnitOfWork(repository),
      {
        sourceId: source.id,
        input: {
          mode: 'quick',
          id: source.id,
          name: source.name,
          configuration: source.configuration,
        },
        copyId: createWorkflowId('quick-copy'),
      },
    );

    expect(result.copy).toMatchObject({
      id: 'quick-copy',
      mode: 'quick',
      name: 'Focus rhythm (Quick copy 2)',
      configuration: source.configuration,
    });
    await expect(repository.list()).resolves.toEqual([
      result.copy,
      existingName,
      result.converted,
    ]);
  });

  test.each([
    ['fractional', [0.1, 0.2, 0.3]],
    ['all-empty', [undefined, undefined, undefined]],
  ] as const)(
    'preserves %s Quick Reward weights without re-normalizing probabilities',
    async (_label, weights) => {
      const source = quickWithWeights(weights);
      const repository = new InMemoryWorkflowRepository([source]);

      const result = await convertQuickWorkflowUseCase(
        repository,
        memoryUnitOfWork(repository),
        {
          sourceId: source.id,
          input: {
            mode: 'quick',
            id: source.id,
            name: source.name,
            configuration: source.configuration,
          },
        },
      );

      expect(result.converted.rewardDice).toEqual(source.rewardDice);
    },
  );

  test('rejects a Detailed source and conflicting copy before commit', async () => {
    const source = detailed('detailed', 'Detailed');
    const repository = new InMemoryWorkflowRepository([source]);
    const commit = vi.fn<WorkflowConversionUnitOfWork['commit']>();

    await expect(
      convertQuickWorkflowUseCase(
        repository,
        { commit },
        {
          sourceId: source.id,
          input: {
            mode: 'quick',
            id: source.id,
            name: 'Draft',
            configuration: quick().configuration,
          },
        },
      ),
    ).rejects.toThrow('Only a Quick Workflow can be converted.');

    const quickSource = quick();
    const conflictRepository = new InMemoryWorkflowRepository([quickSource]);
    await expect(
      convertQuickWorkflowUseCase(
        conflictRepository,
        { commit },
        {
          sourceId: quickSource.id,
          input: {
            mode: 'quick',
            id: quickSource.id,
            name: quickSource.name,
            configuration: quickSource.configuration,
          },
          copyId: quickSource.id,
        },
      ),
    ).rejects.toThrow('Quick copy identifier must be unique.');
    expect(commit).not.toHaveBeenCalled();
  });
});
