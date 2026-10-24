import type { DetailedWorkflow, WorkflowId } from '../domain/Workflow';
import type { QuickWorkflow } from '../domain/QuickWorkflow';

export type WorkflowConversionCommit = Readonly<{
  replacement: DetailedWorkflow;
  copy?: QuickWorkflow;
  order: readonly WorkflowId[];
}>;

export type WorkflowConversionUnitOfWork = Readonly<{
  commit(change: WorkflowConversionCommit): Promise<void>;
}>;

export type WorkflowConversionResult = Readonly<{
  converted: DetailedWorkflow;
  copy?: QuickWorkflow;
  order: readonly WorkflowId[];
}>;
