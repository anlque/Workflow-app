import type { DiceSide, DiceSideInput } from './DiceSide';

export type RewardPhaseType = 'focus' | 'break';

export type FrequencyRewardSchedule = Readonly<{
  type: 'frequency';
  triggerPhaseType: RewardPhaseType;
  frequency: number;
}>;

export type CustomRewardSchedule = Readonly<{
  type: 'custom';
  phaseIndexes: readonly number[];
}>;

export type RewardSchedule = FrequencyRewardSchedule | CustomRewardSchedule;
export type RewardScheduleInput =
  | Readonly<{
      type: 'frequency';
      triggerPhaseType?: RewardPhaseType;
      frequency: number;
    }>
  | Readonly<{ type: 'custom'; phaseIndexes: readonly number[] }>;

export type RewardDice = Readonly<{
  schedule: RewardSchedule;
  rerolls: number;
  sides: readonly [DiceSide, DiceSide, ...DiceSide[]];
}>;

type RewardDiceInputBase = Readonly<{
  rerolls?: number;
  sides: readonly DiceSideInput[];
}>;

export type RewardDiceInput = RewardDiceInputBase &
  (
    | Readonly<{
        schedule: RewardScheduleInput;
        triggerPhaseType?: never;
        frequency?: never;
      }>
    | Readonly<{
        schedule?: never;
        triggerPhaseType?: RewardPhaseType;
        frequency: number;
      }>
  );
