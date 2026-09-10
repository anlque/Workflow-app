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
  if (dice === undefined) return false;
  const schedule = dice.schedule;
  if (schedule.type === 'custom') {
    return schedule.phaseIndexes.includes(completedPhaseIndex);
  }
  if (
    workflow.phases[completedPhaseIndex]?.type !== schedule.triggerPhaseType
  ) {
    return false;
  }
  const completedMatchingPhaseCount = workflow.phases
    .slice(0, completedPhaseIndex + 1)
    .filter(({ type }) => type === schedule.triggerPhaseType).length;
  return completedMatchingPhaseCount % schedule.frequency === 0;
}
