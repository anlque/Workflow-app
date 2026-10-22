import { createWorkflow } from '../domain/createWorkflow';
import type { CreateWorkflowInput, Workflow } from '../domain/Workflow';
import { WorkflowApplicationError } from './WorkflowApplicationError';
import type { WorkflowRepository } from './WorkflowRepository';

export async function updateWorkflowUseCase(
  repository: WorkflowRepository,
  input: CreateWorkflowInput,
): Promise<Workflow> {
  const workflow = createWorkflow(input);
  const existing = await repository.get(workflow.id);
  if (existing === null) {
    throw new WorkflowApplicationError(
      `Workflow ${workflow.id} was not found.`,
    );
  }
  if (existing.mode !== workflow.mode) {
    throw new WorkflowApplicationError(
      'Workflow configuration mode cannot be changed by update.',
    );
  }

  await repository.save(workflow);
  return workflow;
}
