import { describe, expect, test } from 'vitest';

import { createWorkflow } from '../domain/createWorkflow';
import type { CreateWorkflowInput, WorkflowId } from '../domain/Workflow';
import { createWorkflowUseCase } from './createWorkflowUseCase';
import { deleteWorkflowUseCase } from './deleteWorkflowUseCase';
import { duplicateWorkflowUseCase } from './duplicateWorkflowUseCase';
import { listWorkflowsUseCase } from './listWorkflowsUseCase';
import { reorderWorkflowsUseCase } from './reorderWorkflowsUseCase';
import { InMemoryWorkflowRepository } from './testing/InMemoryWorkflowRepository';
import { updateWorkflowUseCase } from './updateWorkflowUseCase';

const workflowInput = (id: string, name: string): CreateWorkflowInput => ({
  id,
  name,
  phases: [
    {
      type: 'focus',
      durationSeconds: 1_500,
      environment: {},
    },
  ],
});

const workflowId = (value: string): WorkflowId =>
  createWorkflow(workflowInput(value, 'ID fixture')).id;

describe('Workflow use cases', () => {
  test('creates and appends a Workflow to the library', async () => {
    const repository = new InMemoryWorkflowRepository();

    const created = await createWorkflowUseCase(
      repository,
      workflowInput('one', 'Deep work'),
    );

    expect(created.name).toBe('Deep work');
    await expect(repository.list()).resolves.toEqual([created]);
  });

  test('rejects creation when the identifier already exists', async () => {
    const existing = createWorkflow(workflowInput('one', 'Existing'));
    const repository = new InMemoryWorkflowRepository([existing]);

    await expect(
      createWorkflowUseCase(repository, workflowInput('one', 'Replacement')),
    ).rejects.toThrow('Workflow one already exists.');
  });

  test('updates an existing Workflow without changing its order', async () => {
    const first = createWorkflow(workflowInput('one', 'First'));
    const second = createWorkflow(workflowInput('two', 'Second'));
    const repository = new InMemoryWorkflowRepository([first, second]);

    const updated = await updateWorkflowUseCase(
      repository,
      workflowInput('one', 'Updated first'),
    );

    expect(updated.name).toBe('Updated first');
    await expect(repository.list()).resolves.toEqual([updated, second]);
  });

  test('rejects updating a missing Workflow', async () => {
    const repository = new InMemoryWorkflowRepository();

    await expect(
      updateWorkflowUseCase(repository, workflowInput('missing', 'Missing')),
    ).rejects.toThrow('Workflow missing was not found.');
  });

  test('duplicates a Workflow with an independent identifier', async () => {
    const source = createWorkflow({
      ...workflowInput('one', 'Deep work'),
      rewardDice: {
        frequency: 1,
        rerolls: 3,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const repository = new InMemoryWorkflowRepository([source]);

    const duplicate = await duplicateWorkflowUseCase(
      repository,
      source.id,
      workflowId('copy'),
    );

    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.name).toBe(source.name);
    expect(duplicate.phases).toEqual(source.phases);
    expect(duplicate.rewardDice).toEqual(source.rewardDice);
    expect(duplicate.rewardDice?.rerolls).toBe(3);
    await expect(repository.list()).resolves.toEqual([source, duplicate]);
  });

  test('rejects duplicate creation when the new identifier exists', async () => {
    const first = createWorkflow(workflowInput('one', 'First'));
    const second = createWorkflow(workflowInput('two', 'Second'));
    const repository = new InMemoryWorkflowRepository([first, second]);

    await expect(
      duplicateWorkflowUseCase(repository, first.id, second.id),
    ).rejects.toThrow('Workflow two already exists.');
  });

  test('deletes an existing Workflow', async () => {
    const existing = createWorkflow(workflowInput('one', 'Existing'));
    const repository = new InMemoryWorkflowRepository([existing]);

    await deleteWorkflowUseCase(repository, existing.id);

    await expect(repository.list()).resolves.toEqual([]);
  });

  test('rejects deleting a missing Workflow', async () => {
    const repository = new InMemoryWorkflowRepository();

    await expect(
      deleteWorkflowUseCase(repository, workflowId('missing')),
    ).rejects.toThrow('Workflow missing was not found.');
  });

  test('lists Workflows in repository order', async () => {
    const first = createWorkflow(workflowInput('one', 'First'));
    const second = createWorkflow(workflowInput('two', 'Second'));
    const repository = new InMemoryWorkflowRepository([first, second]);

    await expect(listWorkflowsUseCase(repository)).resolves.toEqual([
      first,
      second,
    ]);
  });

  test('reorders the complete Workflow Library', async () => {
    const first = createWorkflow(workflowInput('one', 'First'));
    const second = createWorkflow(workflowInput('two', 'Second'));
    const repository = new InMemoryWorkflowRepository([first, second]);

    await reorderWorkflowsUseCase(repository, [second.id, first.id]);

    await expect(repository.list()).resolves.toEqual([second, first]);
  });

  test.each([
    ['missing identifier', ['one'] as const],
    ['unknown identifier', ['one', 'unknown'] as const],
    ['duplicate identifier', ['one', 'one'] as const],
  ])('rejects an incomplete reorder with %s', async (_caseName, ids) => {
    const first = createWorkflow(workflowInput('one', 'First'));
    const second = createWorkflow(workflowInput('two', 'Second'));
    const repository = new InMemoryWorkflowRepository([first, second]);

    await expect(
      reorderWorkflowsUseCase(repository, ids.map(workflowId)),
    ).rejects.toThrow(
      'Workflow order must contain every existing Workflow exactly once.',
    );
    await expect(repository.list()).resolves.toEqual([first, second]);
  });
});
