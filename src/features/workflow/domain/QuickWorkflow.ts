import type { Environment, EnvironmentInput } from './Environment';
import type { DurationSeconds, Phase } from './Phase';
import type { RewardDice } from './RewardDice';
import type { WorkflowId } from './Workflow';

export type QuickPhaseConfiguration = Readonly<{
  durationSeconds: DurationSeconds;
  environment: Environment;
}>;

export type QuickPhaseConfigurationInput = Readonly<{
  durationSeconds: number;
  environment: EnvironmentInput;
}>;

export type QuickLongBreakConfiguration = QuickPhaseConfiguration &
  Readonly<{ frequency: number }>;
export type QuickLongBreakConfigurationInput = QuickPhaseConfigurationInput &
  Readonly<{ frequency: number }>;

export type QuickDiceSide = Readonly<{
  icon: string;
  title: string;
  weight?: number;
}>;
export type QuickDiceSideInput = QuickDiceSide;

export type QuickRewardDiceConfiguration = Readonly<{
  frequency: number;
  sides: readonly [QuickDiceSide, QuickDiceSide, ...QuickDiceSide[]];
}>;
export type QuickRewardDiceConfigurationInput = Readonly<{
  frequency: number;
  sides: readonly QuickDiceSideInput[];
}>;

export type QuickWorkflowConfiguration = Readonly<{
  cycleCount: number;
  focus: QuickPhaseConfiguration;
  shortBreak: QuickPhaseConfiguration;
  longBreak?: QuickLongBreakConfiguration;
  rewardDice?: QuickRewardDiceConfiguration;
}>;
export type QuickWorkflowConfigurationInput = Readonly<{
  cycleCount: number;
  focus: QuickPhaseConfigurationInput;
  shortBreak: QuickPhaseConfigurationInput;
  longBreak?: QuickLongBreakConfigurationInput;
  rewardDice?: QuickRewardDiceConfigurationInput;
}>;

export type QuickWorkflow = Readonly<{
  mode: 'quick';
  id: WorkflowId;
  name: string;
  configuration: QuickWorkflowConfiguration;
  phases: readonly [Phase, ...Phase[]];
  rewardDice?: RewardDice;
}>;

export type CreateQuickWorkflowInput = Readonly<{
  mode: 'quick';
  id: string;
  name: string;
  configuration: QuickWorkflowConfigurationInput;
  phases?: never;
  rewardDice?: never;
}>;
