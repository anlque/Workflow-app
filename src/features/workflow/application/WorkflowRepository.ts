import type { Workflow, WorkflowId } from '../domain/Workflow';

export type WorkflowRepository = {
  list(): Promise<readonly Workflow[]>;
  get(id: WorkflowId): Promise<Workflow | null>;
  save(workflow: Workflow): Promise<void>;
  delete(id: WorkflowId): Promise<void>;
  replaceOrder(ids: readonly WorkflowId[]): Promise<void>;
};
