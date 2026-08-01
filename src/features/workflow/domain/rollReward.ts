import type { DiceSide } from './DiceSide';
import type { RewardDice } from './RewardDice';
import { WorkflowValidationError } from './WorkflowErrors';

export function rollReward(dice: RewardDice, random: () => number): DiceSide {
  const randomValue = random();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new WorkflowValidationError(
      'Random source must return a finite number in [0, 1).',
    );
  }

  let cumulativeProbability = 0;
  let selectedSide = dice.sides[0];
  for (const side of dice.sides) {
    selectedSide = side;
    cumulativeProbability += side.probability;
    if (randomValue < cumulativeProbability) {
      return side;
    }
  }

  return selectedSide;
}
