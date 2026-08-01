import { useEffect, useState } from 'react';

import { getRemainingSeconds, type Session } from '@/features/session';
import { Button } from '@/shared';

export type CompactActiveSessionBarProps = Readonly<{
  session: Session;
  now?: () => number;
  onReturn(): void;
}>;

const systemNow = (): number => Date.now();

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CompactActiveSessionBar({
  session,
  now = systemNow,
  onReturn,
}: CompactActiveSessionBarProps) {
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

  const workflow = session.snapshot.workflow;
  const phase =
    workflow.phases[session.currentPhaseIndex] ?? workflow.phases[0];

  return (
    <section
      className="compact-session-bar"
      aria-label="Active session summary"
    >
      <div className="compact-session-bar__summary">
        <strong>{workflow.name}</strong>
        <span>{phase.type === 'focus' ? 'Focus' : 'Break'}</span>
      </div>
      <output aria-label="Compact time remaining">
        {formatSeconds(getRemainingSeconds(session, displayNow))}
      </output>
      <Button variant="secondary" onClick={onReturn}>
        Return to session
      </Button>
    </section>
  );
}
