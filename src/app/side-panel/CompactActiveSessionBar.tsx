import { CompactSessionSummary, type Session } from '@/features/session';
import { Button } from '@/shared';

export type CompactActiveSessionBarProps = Readonly<{
  session: Session;
  now?: () => number;
  onReturn(): void;
}>;

export function CompactActiveSessionBar({
  session,
  now,
  onReturn,
}: CompactActiveSessionBarProps) {
  return (
    <section
      className="compact-session-bar"
      aria-label="Active session summary"
    >
      <CompactSessionSummary
        session={session}
        {...(now === undefined ? {} : { now })}
      />
      <Button variant="secondary" onClick={onReturn}>
        Return to session
      </Button>
    </section>
  );
}
