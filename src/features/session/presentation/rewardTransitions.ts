import { isRewardDueAfterPhase, type RewardDice } from '@/features/workflow';

import type { Session } from '../domain/Session';

export function rewardOpportunityForSessionTransition(
  previous: Session | null,
  current: Session,
): RewardDice | null {
  const dice = current.snapshot.workflow.rewardDice;
  if (dice === undefined) return null;

  if (current.status === 'paused' && current.pauseReason === 'reward') {
    if (previous === null) return dice;
    if (previous.id !== current.id) return null;
    return previous.status === 'paused' &&
      previous.pauseReason === 'reward' &&
      previous.currentPhaseIndex === current.currentPhaseIndex
      ? null
      : dice;
  }

  if (
    current.status === 'completed' &&
    previous !== null &&
    previous.id === current.id &&
    previous.status !== 'completed' &&
    previous.status !== 'stopped' &&
    isRewardDueAfterPhase(current.snapshot.workflow, current.currentPhaseIndex)
  ) {
    return dice;
  }

  return null;
}
