import { useCallback, useEffect, useRef } from 'react';

import type { Session } from '@/features/session';

import { completionCue } from './completionCue';
import type { UiSoundPlayer } from './createUiSoundPlayer';

type CompletionSounds = Pick<
  UiSoundPlayer,
  'playSessionComplete' | 'playRewardUnlocked'
>;

export function useCompletionCue(
  session: Session | null,
  sounds: CompletionSounds,
  delayMs = 1_000,
): () => void {
  const previousSession = useRef<Session | null>(null);
  const revealTimer = useRef<number | null>(null);

  const scheduleCompletionReveal = useCallback(() => {
    if (revealTimer.current !== null) {
      window.clearTimeout(revealTimer.current);
    }
    revealTimer.current = window.setTimeout(() => {
      revealTimer.current = null;
      sounds.playSessionComplete();
    }, delayMs);
  }, [delayMs, sounds]);

  useEffect(() => {
    const previous = previousSession.current;
    previousSession.current = session;
    if (session === null) return;
    const cue = completionCue(previous, session);
    if (cue === null) return;
    const timer = window.setTimeout(() => {
      if (cue === 'reward') sounds.playRewardUnlocked();
      else sounds.playSessionComplete();
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, session, sounds]);

  useEffect(
    () => () => {
      if (revealTimer.current !== null) {
        window.clearTimeout(revealTimer.current);
      }
    },
    [],
  );

  return scheduleCompletionReveal;
}
