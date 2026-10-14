import {
  formatSessionCountdown,
  getActiveSessionSegment,
  type Session,
} from '@/features/session';

const STABLE_TITLE = 'Locusora focus';

export function formatFocusDocumentTitle(
  session: Session | null,
  now: number,
): string {
  if (
    session === null ||
    session.status === 'completed' ||
    session.status === 'stopped'
  ) {
    return STABLE_TITLE;
  }

  const countdown = formatSessionCountdown(session, now);
  if (session.status === 'transitioning') {
    return `${countdown} · Transition · Locusora`;
  }

  const segment = getActiveSessionSegment(session);
  return segment.isBonus
    ? `${countdown} · Bonus · ${segment.label} · Locusora`
    : `${countdown} · ${segment.label} · Locusora`;
}
