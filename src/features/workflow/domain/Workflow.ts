import type { Phase, PhaseInput } from './Phase';
import type { RewardDice, RewardDiceInput } from './RewardDice';

declare const workflowIdBrand: unique symbol;

export type WorkflowId = string & { readonly [workflowIdBrand]: 'WorkflowId' };

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
