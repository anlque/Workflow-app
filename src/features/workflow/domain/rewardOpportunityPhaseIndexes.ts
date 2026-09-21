import type { Workflow } from './Workflow';

export function rewardOpportunityPhaseIndexes(
  workflow: Pick<Workflow, 'phases' | 'rewardDice'>,
): readonly number[] {
  const schedule = workflow.rewardDice?.schedule;
  if (schedule === undefined) return Object.freeze([]);
  if (schedule.type === 'custom') {
    return Object.freeze([...schedule.phaseIndexes]);
  }

  let matchingPhaseCount = 0;
  return Object.freeze(
    workflow.phases.flatMap((phase, index) => {
      if (phase.type !== schedule.triggerPhaseType) return [];
      matchingPhaseCount += 1;
      return matchingPhaseCount % schedule.frequency === 0 ? [index] : [];
    }),
  );
}
