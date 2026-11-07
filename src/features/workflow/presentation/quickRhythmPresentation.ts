import { parseQuickIntegerInRange } from './quickDraftParsing';
import { minutesToDurationSeconds } from './useWorkflowEditor';

export type QuickRhythmPresentationInput = Readonly<{
  cycleCount: string;
  focusDurationMinutes: string;
  shortBreakDurationMinutes: string;
  longBreak: Readonly<{
    enabled: boolean;
    frequency: string;
    durationMinutes: string;
  }>;
  reward: Readonly<{
    enabled: boolean;
    frequency: string;
  }>;
}>;

export type QuickRhythmCycle = Readonly<{
  cycleNumber: number;
  focusDurationMinutes: string;
  breakType: 'Short break' | 'Long break';
  breakDurationMinutes: string;
  rewardAfterCycle: boolean;
}>;

export function createQuickRhythmPresentation(
  input: QuickRhythmPresentationInput,
): readonly QuickRhythmCycle[] | null {
  const cycleCount = parseQuickIntegerInRange(input.cycleCount, 1, 20);
  const longBreakFrequency = input.longBreak.enabled
    ? parseQuickIntegerInRange(input.longBreak.frequency, 1, cycleCount ?? 0)
    : null;
  const rewardFrequency = input.reward.enabled
    ? parseQuickIntegerInRange(input.reward.frequency, 1, cycleCount ?? 0)
    : null;
  if (
    cycleCount === null ||
    minutesToDurationSeconds(input.focusDurationMinutes) === null ||
    minutesToDurationSeconds(input.shortBreakDurationMinutes) === null ||
    (input.longBreak.enabled &&
      minutesToDurationSeconds(input.longBreak.durationMinutes) === null) ||
    (input.longBreak.enabled && longBreakFrequency === null) ||
    (input.reward.enabled && rewardFrequency === null)
  ) {
    return null;
  }

  return Array.from({ length: cycleCount }, (_, index) => {
    const cycleNumber = index + 1;
    const isLongBreak =
      longBreakFrequency !== null && cycleNumber % longBreakFrequency === 0;
    return {
      cycleNumber,
      focusDurationMinutes: input.focusDurationMinutes,
      breakType: isLongBreak ? 'Long break' : 'Short break',
      breakDurationMinutes: isLongBreak
        ? input.longBreak.durationMinutes
        : input.shortBreakDurationMinutes,
      rewardAfterCycle:
        rewardFrequency !== null && cycleNumber % rewardFrequency === 0,
    };
  });
}
