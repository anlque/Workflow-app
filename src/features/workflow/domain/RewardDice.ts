import type { DiceSide, DiceSideInput } from './DiceSide';

export type RewardPhaseType = 'focus' | 'break';

export type RewardDice = Readonly<{
  triggerPhaseType: RewardPhaseType;
  frequency: number;
  rerolls: number;
  sides: readonly [DiceSide, DiceSide, ...DiceSide[]];
}>;

export type RewardDiceInput = Readonly<{
  triggerPhaseType?: RewardPhaseType;
  frequency: number;
  rerolls?: number;
  sides: readonly DiceSideInput[];
}>;
