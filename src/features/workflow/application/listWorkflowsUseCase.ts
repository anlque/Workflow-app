import type { Workflow } from '../domain/Workflow';
import type { WorkflowRepository } from './WorkflowRepository';

export function listWorkflowsUseCase(
  repository: WorkflowRepository,
): Promise<readonly Workflow[]> {
  return repository.list();
}
