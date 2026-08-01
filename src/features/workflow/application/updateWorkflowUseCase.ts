import { createWorkflow } from '../domain/createWorkflow';
import type { CreateWorkflowInput, Workflow } from '../domain/Workflow';
import { WorkflowApplicationError } from './WorkflowApplicationError';
import type { WorkflowRepository } from './WorkflowRepository';

export async function updateWorkflowUseCase(
  repository: WorkflowRepository,
  input: CreateWorkflowInput,
): Promise<Workflow> {
  const workflow = createWorkflow(input);
  if ((await repository.get(workflow.id)) === null) {
    throw new WorkflowApplicationError(
      `Workflow ${workflow.id} was not found.`,
    );
  }

  await repository.save(workflow);
  return workflow;
}
