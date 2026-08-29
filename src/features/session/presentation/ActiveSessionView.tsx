import { useEffect, useRef, useState } from 'react';

import type { RewardDice } from '@/features/workflow';

import type { Session, SessionId } from '../domain/Session';
import { SessionControls } from './SessionControls';
import { RewardResultDialog } from './RewardResultDialog';
import { didCrossPhaseBoundary } from './didCrossPhaseBoundary';
import { rewardOpportunityForSessionTransition } from './rewardTransitions';
import { formatSessionCountdown } from './sessionCountdown';

export type ActiveSessionViewProps = Readonly<{
  session: Session;
  now?: () => number;
  random?: () => number;
  reducedMotion?: boolean;
  onPhaseBoundary?(): void;
  onFinalRewardContinued?(): void;
  rewardInteraction?: Readonly<{
    onRoll(durationMs: 600 | 2500): void;
    continueReward(id: SessionId): Promise<void>;
  }>;
  onPause(id: SessionId): Promise<void>;
  onResume(id: SessionId): Promise<void>;
  onStop(id: SessionId): Promise<void>;
}>;

const systemNow = (): number => Date.now();
const systemRandom = (): number => Math.random();

type RewardOpportunity = Readonly<{
  key: string;
  sessionId: SessionId;
  dice: RewardDice;
}>;

function rewardOpportunity(
  session: Session,
  dice: RewardDice,
): RewardOpportunity {
  const status = session.status === 'completed' ? 'completed' : 'paused';
  return {
    key: `${session.id}:${String(session.currentPhaseIndex)}:${status}`,
    sessionId: session.id,
    dice,
  };
}

export function ActiveSessionView({
  session,
  now = systemNow,
  random = systemRandom,
  reducedMotion = false,
  onPhaseBoundary,
  onFinalRewardContinued,
  rewardInteraction,
  onPause,
  onResume,
  onStop,
}: ActiveSessionViewProps) {
  const [displayNow, setDisplayNow] = useState(now);
  const [reward, setReward] = useState<RewardOpportunity | null>(() => {
    if (rewardInteraction === undefined) return null;
    const dice = rewardOpportunityForSessionTransition(null, session);
    return dice === null ? null : rewardOpportunity(session, dice);
  });
  const previousSession = useRef(session);

  useEffect(() => {
    const previous = previousSession.current;
    const rewardBaseline = previous.id === session.id ? previous : null;
    const nextReward = rewardOpportunityForSessionTransition(
      rewardBaseline,
      session,
    );
    previousSession.current = session;
    if (didCrossPhaseBoundary(previous, session)) {
      onPhaseBoundary?.();
    }
    if (previous.id !== session.id) {
      setReward(null);
    }
    if (nextReward !== null && rewardInteraction !== undefined) {
      setReward(rewardOpportunity(session, nextReward));
    }
  }, [onPhaseBoundary, rewardInteraction, session]);

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
  const rewardResult =
    reward?.sessionId !== session.id ||
    rewardInteraction === undefined ? null : (
      <RewardResultDialog
        key={reward.key}
        dice={reward.dice}
        random={random}
        reducedMotion={reducedMotion}
        onRoll={rewardInteraction.onRoll}
        onContinue={async () => {
          const isFinalReward = session.status === 'completed';
          if (session.status === 'paused' && session.pauseReason === 'reward') {
            await rewardInteraction.continueReward(session.id);
          }
          setReward(null);
          if (isFinalReward) onFinalRewardContinued?.();
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
    <section
      className="active-session"
      data-transitioning={
        session.status === 'transitioning' ? 'true' : undefined
      }
    >
      <h1>{workflow.name}</h1>
      <p className="session-phase">
        {session.status === 'transitioning' ? (
          'Transitioning to the next phase…'
        ) : (
          <>
            {phase.type === 'focus' ? 'Focus' : 'Break'} · Phase{' '}
            {session.currentPhaseIndex + 1} of {workflow.phases.length}
          </>
        )}
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
