import type { DiceSide } from './DiceSide';
import type { Workflow } from './Workflow';
import { WorkflowValidationError } from './WorkflowErrors';
import { rewardOpportunityPhaseIndexes } from './rewardOpportunityPhaseIndexes';

export function eligibleDiceSides(
  workflow: Pick<Workflow, 'phases' | 'rewardDice'>,
  completedPhaseIndex: number,
): readonly DiceSide[] {
  const dice = workflow.rewardDice;
  if (dice === undefined) return Object.freeze([]);
  const opportunities = rewardOpportunityPhaseIndexes(workflow);
  const opportunityIndex = opportunities.indexOf(completedPhaseIndex);
  if (opportunityIndex < 0) {
    throw new WorkflowValidationError(
      'Reward can only be rolled for a configured opportunity.',
    );
  }

  const lastIndex = opportunities.length - 1;
  const isEarly = opportunityIndex * 2 <= lastIndex;
  const isLate = opportunityIndex * 2 >= lastIndex;
  return Object.freeze(
    dice.sides.filter(
      ({ availability }) =>
        availability === 'any' ||
        (availability === 'early' && isEarly) ||
        (availability === 'late' && isLate),
    ),
  );
}
