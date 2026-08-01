import { useEffect, useRef, useState } from 'react';

import type { DiceSide } from '@/features/workflow';

import type { Session, SessionId } from '../domain/Session';
import { SessionControls } from './SessionControls';
import { RewardResultDialog } from './RewardResultDialog';
import { didCrossPhaseBoundary } from './didCrossPhaseBoundary';
import { rewardsForSessionTransition } from './rewardTransitions';
import { formatSessionCountdown } from './sessionCountdown';

export type ActiveSessionViewProps = Readonly<{
  session: Session;
  now?: () => number;
  random?: () => number;
  reducedMotion?: boolean;
  onPhaseBoundary?(): void;
  onRewardRoll?(): void;
  onPause(id: SessionId): Promise<void>;
  onResume(id: SessionId): Promise<void>;
  onStop(id: SessionId): Promise<void>;
}>;

const systemNow = (): number => Date.now();
const systemRandom = (): number => Math.random();

export function ActiveSessionView({
  session,
  now = systemNow,
  random = systemRandom,
  reducedMotion = false,
  onPhaseBoundary,
  onRewardRoll,
  onPause,
  onResume,
  onStop,
}: ActiveSessionViewProps) {
  const [displayNow, setDisplayNow] = useState(now);
  const [rewards, setRewards] = useState<readonly DiceSide[]>([]);
  const previousSession = useRef(session);

  useEffect(() => {
    const previous = previousSession.current;
    const nextRewards = rewardsForSessionTransition(previous, session, random);
    previousSession.current = session;
    if (didCrossPhaseBoundary(previous, session)) {
      onPhaseBoundary?.();
    }
    if (nextRewards.length > 0) {
      setRewards((current) => [...current, ...nextRewards]);
    }
  }, [onPhaseBoundary, random, session]);

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
  const rewardDialog = rewards[0];
  const rewardResult =
    rewardDialog === undefined ? null : (
      <RewardResultDialog
        reward={rewardDialog}
        reducedMotion={reducedMotion}
        {...(onRewardRoll === undefined ? {} : { onRoll: onRewardRoll })}
        onDismiss={() => {
          setRewards((current) => current.slice(1));
        }}
      />
    );

  if (session.status === 'completed' || session.status === 'stopped') {
    return (
      <section className="active-session" aria-live="polite">
        <h1>{workflow.name}</h1>
        <p className="session-terminal">
          {session.status === 'completed'
            ? 'Session complete'
            : 'Session stopped'}
        </p>
        {rewardResult}
      </section>
    );
  }

  const phase =
    workflow.phases[session.currentPhaseIndex] ?? workflow.phases[0];
  return (
    <section className="active-session">
      <h1>{workflow.name}</h1>
      <p className="session-phase">
        {phase.type === 'focus' ? 'Focus' : 'Break'} · Phase{' '}
        {session.currentPhaseIndex + 1} of {workflow.phases.length}
      </p>
      <output className="session-countdown" aria-label="Time remaining">
        {formatSessionCountdown(session, displayNow)}
      </output>
      <SessionControls
        session={session}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
      />
      {rewardResult}
    </section>
  );
}
