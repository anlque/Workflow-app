import type { Session } from '@/features/session';
import { isRewardDueAfterPhase } from '@/features/workflow';

export type CompletionCue = 'complete' | 'reward';

export function completionCue(
  previous: Session | null,
  current: Session,
): CompletionCue | null {
  const previousStatus = previous?.status;
  const isFinalReward =
    current.status === 'paused' &&
    current.pauseReason === 'reward' &&
    current.rewardRitual?.continuation.type === 'complete';
  if (
    previous?.id !== current.id ||
    previousStatus === 'completed' ||
    previousStatus === 'stopped' ||
    (current.status !== 'completed' && !isFinalReward)
  ) {
    return null;
  }

  if (isFinalReward) return 'reward';
  return isRewardDueAfterPhase(
    current.snapshot.workflow,
    current.currentPhaseIndex,
  )
    ? 'reward'
    : 'complete';
}
