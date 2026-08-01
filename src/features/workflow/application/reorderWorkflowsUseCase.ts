import type { WorkflowId } from '../domain/Workflow';
import { WorkflowApplicationError } from './WorkflowApplicationError';
import type { WorkflowRepository } from './WorkflowRepository';

export async function reorderWorkflowsUseCase(
  repository: WorkflowRepository,
  ids: readonly WorkflowId[],
): Promise<void> {
  const existingIds = (await repository.list()).map(({ id }) => id);
  const requestedIds = new Set(ids);
  const isCompletePermutation =
    ids.length === existingIds.length &&
    requestedIds.size === ids.length &&
    existingIds.every((id) => requestedIds.has(id));

  if (!isCompletePermutation) {
    throw new WorkflowApplicationError(
      'Workflow order must contain every existing Workflow exactly once.',
    );
  }

  await repository.replaceOrder(ids);
}
