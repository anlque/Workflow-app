import { getRemainingSeconds, type Session } from '../domain/Session';

export function formatSessionCountdown(session: Session, now: number): string {
  const totalSeconds = getRemainingSeconds(session, now);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
