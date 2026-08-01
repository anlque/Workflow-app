import { rollReward, type DiceSide } from '@/features/workflow';

import type { Session } from '../domain/Session';

export function rewardsForSessionTransition(
  previous: Session | null,
  current: Session,
  random: () => number,
): readonly DiceSide[] {
  if (previous === null) return [];
  if (
    previous.id !== current.id ||
    previous.status === 'completed' ||
    previous.status === 'stopped'
  ) {
    return [];
  }

  const workflow = current.snapshot.workflow;
  const dice = workflow.rewardDice;
  if (dice === undefined) return [];

  const lastCompletedIndex =
    current.status === 'completed'
      ? current.currentPhaseIndex
      : current.currentPhaseIndex - 1;
  if (lastCompletedIndex < previous.currentPhaseIndex) return [];

  const rewards: DiceSide[] = [];
  for (
    let index = previous.currentPhaseIndex;
    index <= lastCompletedIndex;
    index += 1
  ) {
    const phase = workflow.phases[index];
    if (phase?.type !== 'focus') continue;
    const completedFocusCount = workflow.phases
      .slice(0, index + 1)
      .filter(({ type }) => type === 'focus').length;
    if (completedFocusCount % dice.frequency === 0) {
      rewards.push(rollReward(dice, random));
    }
  }
  return Object.freeze(rewards);
}
