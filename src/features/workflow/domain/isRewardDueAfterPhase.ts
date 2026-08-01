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
    workflow.phases[completedPhaseIndex]?.type !== 'focus'
  ) {
    return false;
  }
  const completedFocusCount = workflow.phases
    .slice(0, completedPhaseIndex + 1)
    .filter(({ type }) => type === 'focus').length;
  return completedFocusCount % dice.frequency === 0;
}
