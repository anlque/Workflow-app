import { useEffect, useRef } from 'react';

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
): void {
  const previousSession = useRef<Session | null>(null);
  const cueTimers = useRef(new Set<number>());

  useEffect(() => {
    const previous = previousSession.current;
    previousSession.current = session;
    if (session === null) {
      cueTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      cueTimers.current.clear();
      return;
    }
    const cue = completionCue(previous, session);
    if (cue === null) return;
    const timer = window.setTimeout(() => {
      cueTimers.current.delete(timer);
      if (cue === 'reward') sounds.playRewardUnlocked();
      else sounds.playSessionComplete();
    }, delayMs);
    cueTimers.current.add(timer);
  }, [delayMs, session, sounds]);

  useEffect(
    () => () => {
      cueTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      cueTimers.current.clear();
    },
    [],
  );
}
