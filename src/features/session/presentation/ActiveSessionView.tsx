import { useEffect, useRef, useState } from 'react';

import type { Session, SessionId } from '../domain/Session';
import { SessionControls } from './SessionControls';
import { RewardResultDialog } from './RewardResultDialog';
import { didCrossPhaseBoundary } from './didCrossPhaseBoundary';
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
    rollReward?(id: SessionId): Promise<void>;
    rerollReward?(id: SessionId): Promise<void>;
    continueReward(id: SessionId): Promise<void>;
  }>;
  onPause(id: SessionId): Promise<void>;
  onResume(id: SessionId): Promise<void>;
  onStop(id: SessionId): Promise<void>;
}>;

const systemNow = (): number => Date.now();
export function ActiveSessionView({
  session,
  now = systemNow,
  reducedMotion = false,
  onPhaseBoundary,
  onFinalRewardContinued,
  rewardInteraction,
  onPause,
  onResume,
  onStop,
}: ActiveSessionViewProps) {
  const [displayNow, setDisplayNow] = useState(now);
  const previousSession = useRef(session);

  useEffect(() => {
    const previous = previousSession.current;
    previousSession.current = session;
    if (didCrossPhaseBoundary(previous, session)) {
      onPhaseBoundary?.();
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
  const ritual =
    session.status === 'paused' && session.pauseReason === 'reward'
      ? session.rewardRitual
      : undefined;
  const dice = workflow.rewardDice;
  const selectedReward =
    ritual?.selectedSideIndex === undefined || dice === undefined
      ? null
      : (dice.sides[ritual.selectedSideIndex] ?? null);
  const rewardResult =
    ritual === undefined ||
    dice === undefined ||
    rewardInteraction === undefined ? null : (
      <RewardResultDialog
        key={ritual.id}
        reward={selectedReward}
        usedRerolls={ritual.rerollsUsed}
        rerolls={dice.rerolls}
        reducedMotion={reducedMotion}
        onRoll={rewardInteraction.onRoll}
        requestRoll={() =>
          rewardInteraction.rollReward?.(session.id) ?? Promise.resolve()
        }
        requestReroll={() =>
          rewardInteraction.rerollReward?.(session.id) ?? Promise.resolve()
        }
        onContinue={async () => {
          const isFinalReward = ritual.continuation.type === 'complete';
          await rewardInteraction.continueReward(session.id);
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
