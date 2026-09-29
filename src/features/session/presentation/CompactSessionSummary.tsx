import { useEffect, useState } from 'react';

import { getRemainingSeconds, type Session } from '../domain/Session';
import { getActiveSessionSegment } from './getActiveSessionSegment';

export type CompactSessionSummaryProps = Readonly<{
  session: Session;
  now?: () => number;
}>;

const systemNow = (): number => Date.now();

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CompactSessionSummary({
  session,
  now = systemNow,
}: CompactSessionSummaryProps) {
  const [displayNow, setDisplayNow] = useState(now);

  useEffect(() => {
    setDisplayNow(now());
    if (session.status !== 'running') return;
    const timer = window.setInterval(() => {
      setDisplayNow(now());
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [now, session.status]);

  const segment = getActiveSessionSegment(session);

  return (
    <div className="compact-session-summary">
      <div className="compact-session-summary__identity">
        <strong>{session.snapshot.workflow.name}</strong>
        <span>
          {segment.isBonus
            ? `Bonus · ${segment.label}`
            : segment.label.split(' · ')[0]}
        </span>
      </div>
      <output aria-label="Compact time remaining">
        {formatSeconds(getRemainingSeconds(session, displayNow))}
      </output>
    </div>
  );
}
