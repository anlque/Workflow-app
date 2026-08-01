import type { Workflow } from './Workflow';

export function isRewardDueAfterPhase(
  workflow: Workflow,
  completedPhaseIndex: number,
): boolean {
  if (
    !Number.isInteger(completedPhaseIndex) ||
    completedPhaseIndex < 0 ||
    completedPhaseIndex >= workflow.phases.length
  ) {
    return false;
  }
  const dice = workflow.rewardDice;
  if (
    dice === undefined ||
    workflow.phases[completedPhaseIndex]?.type !== dice.triggerPhaseType
  ) {
    return false;
  }
  const completedMatchingPhaseCount = workflow.phases
    .slice(0, completedPhaseIndex + 1)
    .filter(({ type }) => type === dice.triggerPhaseType).length;
  return completedMatchingPhaseCount % dice.frequency === 0;
}
