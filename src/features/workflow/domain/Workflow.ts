import type { Phase, PhaseInput } from './Phase';
import type { RewardDice, RewardDiceInput } from './RewardDice';
import type { CreateQuickWorkflowInput, QuickWorkflow } from './QuickWorkflow';
import { WorkflowValidationError } from './WorkflowErrors';

declare const workflowIdBrand: unique symbol;

export type WorkflowId = string & { readonly [workflowIdBrand]: 'WorkflowId' };

export function createWorkflowId(value: string): WorkflowId {
  if (value.trim().length === 0) {
    throw new WorkflowValidationError('Workflow identifier must not be empty.');
  }

  return value as WorkflowId;
}

export type DetailedWorkflow = Readonly<{
  mode: 'detailed';
  id: WorkflowId;
  name: string;
  phases: readonly [Phase, ...Phase[]];
  rewardDice?: RewardDice;
}>;

export type CreateDetailedWorkflowInput = Readonly<{
  mode?: 'detailed';
  id: string;
  name: string;
  phases: readonly PhaseInput[];
  rewardDice?: RewardDiceInput;
  configuration?: never;
}>;

export type Workflow = DetailedWorkflow | QuickWorkflow;
export type CreateWorkflowInput =
  CreateDetailedWorkflowInput | CreateQuickWorkflowInput;
