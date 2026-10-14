import { useEffect } from 'react';

import type { Session } from '@/features/session';

import { formatFocusDocumentTitle } from './focusDocumentTitle';

type TitleTarget = { title: string };

const systemNow = (): number => Date.now();

export function useFocusDocumentTitle(
  session: Session | null,
  now: () => number = systemNow,
  target: TitleTarget = document,
): void {
  useEffect(() => {
    const update = () => {
      const title = formatFocusDocumentTitle(session, now());
      if (target.title !== title) target.title = title;
    };

    update();
    if (session?.status !== 'running' && session?.status !== 'transitioning') {
      return;
    }

    const timer = window.setInterval(update, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [now, session, target]);
}
