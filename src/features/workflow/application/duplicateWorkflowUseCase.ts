import type { Workflow, WorkflowId } from '../domain/Workflow';
import { WorkflowApplicationError } from './WorkflowApplicationError';
import type { WorkflowRepository } from './WorkflowRepository';
import { mapWorkflowConfigurationEnvironments } from './workflowEnvironments';

export async function duplicateWorkflowUseCase(
  repository: WorkflowRepository,
  sourceId: WorkflowId,
  duplicateId: WorkflowId,
): Promise<Workflow> {
  const source = await repository.get(sourceId);
  if (source === null) {
    throw new WorkflowApplicationError(`Workflow ${sourceId} was not found.`);
  }

  if ((await repository.get(duplicateId)) !== null) {
    throw new WorkflowApplicationError(
      `Workflow ${duplicateId} already exists.`,
    );
  }

  const duplicate = await mapWorkflowConfigurationEnvironments(
    source,
    (environment) => environment,
    { id: duplicateId },
  );

  await repository.save(duplicate);
  return duplicate;
}
