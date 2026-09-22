import type { Session } from '@/features/session';

export type CompletionCue = 'complete' | 'reward';

export function completionCue(
  previous: Session | null,
  current: Session,
): CompletionCue | null {
  const currentRitual =
    current.status === 'paused' && current.pauseReason === 'reward'
      ? current.rewardRitual
      : undefined;
  if (previous?.id !== current.id) return null;
  if (currentRitual !== undefined) {
    return previous.rewardRitual?.id === currentRitual.id ? null : 'reward';
  }
  return current.status === 'completed' && previous.status !== 'completed'
    ? 'complete'
    : null;
}
