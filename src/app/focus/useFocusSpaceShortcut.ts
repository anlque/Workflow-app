import { useEffect, useRef, useState } from 'react';

import type { Session, SessionId } from '@/features/session';

import { getFocusSpaceShortcutAction } from './getFocusSpaceShortcutAction';

type Input = Readonly<{
  session: Session | null;
  enabled: boolean;
  studioOpen: boolean;
  activateSounds(): Promise<void>;
  pause(id: SessionId): Promise<void>;
  resume(id: SessionId): Promise<void>;
}>;

export function useFocusSpaceShortcut(input: Input): string | null {
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(input);
  const pending = useRef(false);
  const mounted = useRef(true);
  const sessionId = input.session?.id ?? null;
  const activeSessionId = useRef(sessionId);
  const generation = useRef(0);
  if (activeSessionId.current !== sessionId) {
    activeSessionId.current = sessionId;
    generation.current += 1;
    pending.current = false;
  }
  latest.current = input;

  useEffect(() => {
    setError(null);
  }, [sessionId]);

  useEffect(() => {
    mounted.current = true;
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current;
      const action = getFocusSpaceShortcutAction(event, {
        enabled: current.enabled,
        studioOpen: current.studioOpen,
        dialogOpen: document.querySelector('dialog[open]') !== null,
        pending: pending.current,
        session: current.session,
      });
      if (action === null || current.session === null) return;
      event.preventDefault();
      pending.current = true;
      setError(null);
      void current.activateSounds();
      const command = action === 'pause' ? current.pause : current.resume;
      const commandGeneration = generation.current;
      void command(current.session.id)
        .catch((cause: unknown) => {
          if (mounted.current && generation.current === commandGeneration)
            setError(
              cause instanceof Error ? cause.message : 'Command failed.',
            );
        })
        .finally(() => {
          if (generation.current === commandGeneration) pending.current = false;
        });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      mounted.current = false;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return error;
}
