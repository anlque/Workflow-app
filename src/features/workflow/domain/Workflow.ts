import type { Phase, PhaseInput } from './Phase';
import type { RewardDice, RewardDiceInput } from './RewardDice';
import { WorkflowValidationError } from './WorkflowErrors';

declare const workflowIdBrand: unique symbol;

export type WorkflowId = string & { readonly [workflowIdBrand]: 'WorkflowId' };

export function createWorkflowId(value: string): WorkflowId {
  if (value.trim().length === 0) {
    throw new WorkflowValidationError('Workflow identifier must not be empty.');
  }

  return value as WorkflowId;
}

export type Workflow = Readonly<{
  id: WorkflowId;
  name: string;
  phases: readonly [Phase, ...Phase[]];
  rewardDice?: RewardDice;
}>;

export type CreateWorkflowInput = Readonly<{
  id: string;
  name: string;
  phases: readonly PhaseInput[];
  rewardDice?: RewardDiceInput;
}>;
