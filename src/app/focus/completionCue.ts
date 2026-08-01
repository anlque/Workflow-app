import type { Session } from '@/features/session';
import { isRewardDueAfterPhase } from '@/features/workflow';

export type CompletionCue = 'complete' | 'reward';

export function completionCue(
  previous: Session | null,
  current: Session,
): CompletionCue | null {
  const previousStatus = previous?.status;
  if (
    previous?.id !== current.id ||
    previousStatus === 'completed' ||
    previousStatus === 'stopped' ||
    current.status !== 'completed'
  ) {
    return null;
  }

  return isRewardDueAfterPhase(
    current.snapshot.workflow,
    current.currentPhaseIndex,
  )
    ? 'reward'
    : 'complete';
}
