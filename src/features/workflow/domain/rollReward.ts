import type { DiceSide } from './DiceSide';
import type { Workflow } from './Workflow';
import { WorkflowValidationError } from './WorkflowErrors';
import { eligibleDiceSides } from './eligibleDiceSides';

export function rollReward(
  workflow: Workflow,
  completedPhaseIndex: number,
  random: () => number,
): DiceSide {
  const sides = eligibleDiceSides(workflow, completedPhaseIndex);
  const randomValue = random();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new WorkflowValidationError(
      'Random source must return a finite number in [0, 1).',
    );
  }

  const totalProbability = sides.reduce(
    (total, side) => total + side.probability,
    0,
  );
  let cumulativeProbability = 0;
  let selectedSide = sides[0];
  if (selectedSide === undefined) {
    throw new WorkflowValidationError(
      'Reward opportunity must have at least one eligible Dice Side.',
    );
  }
  for (const side of sides) {
    selectedSide = side;
    cumulativeProbability += side.probability / totalProbability;
    if (randomValue < cumulativeProbability) {
      return side;
    }
  }

  return selectedSide;
}
