import type { DiceSide, DiceSideInput } from './DiceSide';

export type RewardDice = Readonly<{
  frequency: number;
  sides: readonly [DiceSide, DiceSide, ...DiceSide[]];
}>;

export type RewardDiceInput = Readonly<{
  frequency: number;
  sides: readonly DiceSideInput[];
}>;
