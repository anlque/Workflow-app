import type { WorkflowId } from '../domain/Workflow';
import { WorkflowApplicationError } from './WorkflowApplicationError';
import type { WorkflowRepository } from './WorkflowRepository';

export async function deleteWorkflowUseCase(
  repository: WorkflowRepository,
  id: WorkflowId,
): Promise<void> {
  if ((await repository.get(id)) === null) {
    throw new WorkflowApplicationError(`Workflow ${id} was not found.`);
  }

  await repository.delete(id);
}
