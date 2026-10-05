import { useEffect, useRef, useState } from 'react';

import type { DiceSide } from '@/features/workflow';
import { Button, Dialog } from '@/shared';

import {
  RewardCube,
  type RewardCubeResultMedia,
  type RewardCubeTerminalReason,
} from './RewardCube';

type RollDuration = 600 | 3000;
type RewardStage = 'ready' | 'rolling' | 'result';

export type RewardRollPlayback = Readonly<{ stop(): void }>;

type RollAttempt = {
  id: number;
  reroll: boolean;
  startingRerolls: number;
  commandSettled: boolean;
  mediaReason: RewardCubeTerminalReason | null;
  playback: RewardRollPlayback | undefined;
};

export type RewardResultDialogProps = Readonly<{
  reward: DiceSide | null;
  usedRerolls: number;
  rerolls: number;
  reducedMotion: boolean;
  onRoll(durationMs: RollDuration): RewardRollPlayback | undefined;
  requestRoll(): Promise<void>;
  requestReroll(): Promise<void>;
  onContinue(): Promise<void>;
}>;

export function RewardResultDialog({
  reward,
  usedRerolls,
  rerolls,
  reducedMotion,
  onRoll,
  requestRoll,
  requestReroll,
  onContinue,
}: RewardResultDialogProps) {
  const [stage, setStage] = useState<RewardStage>(
    reward === null ? 'ready' : 'result',
  );
  const [attempt, setAttempt] = useState<RollAttempt | null>(null);
  const [resultMedia, setResultMedia] =
    useState<RewardCubeResultMedia>('poster');
  const [animateResult, setAnimateResult] = useState(false);
  const [continuePending, setContinuePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef<RollAttempt | null>(null);
  const nextAttemptIdRef = useRef(0);

  function publishAttempt(next: RollAttempt | null): void {
    attemptRef.current = next;
    setAttempt(next);
  }

  function stopPlayback(current: RollAttempt): void {
    const playback = current.playback;
    current.playback = undefined;
    playback?.stop();
  }

  useEffect(() => {
    if (attempt !== null || stage !== 'ready' || reward === null) return;
    setResultMedia('poster');
    setAnimateResult(false);
    setStage('result');
  }, [attempt, reward, stage]);

  useEffect(() => {
    if (!attempt?.commandSettled) return;
    const projectionSettled = attempt.reroll
      ? usedRerolls > attempt.startingRerolls && reward !== null
      : reward !== null;
    if (!projectionSettled || attempt.mediaReason === null) return;

    setResultMedia(attempt.mediaReason === 'ended' ? 'video' : 'poster');
    setAnimateResult(true);
    publishAttempt(null);
    setStage('result');
  }, [attempt, reward, usedRerolls]);

  useEffect(
    () => () => {
      const current = attemptRef.current;
      attemptRef.current = null;
      if (current !== null) stopPlayback(current);
    },
    [],
  );

  useEffect(() => {
    if (stage === 'result' && usedRerolls > 0 && usedRerolls >= rerolls) {
      actionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [rerolls, stage, usedRerolls]);

  async function continueSession(): Promise<void> {
    if (continuePending) return;
    setContinuePending(true);
    setError(null);
    try {
      await onContinue();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Continuing Session failed.',
      );
    } finally {
      setContinuePending(false);
    }
  }

  async function roll(reroll: boolean): Promise<void> {
    if (attemptRef.current !== null) return;
    setError(null);
    const id = nextAttemptIdRef.current + 1;
    nextAttemptIdRef.current = id;
    const duration: RollDuration = reducedMotion ? 600 : 3_000;
    const current: RollAttempt = {
      id,
      reroll,
      startingRerolls: usedRerolls,
      commandSettled: false,
      mediaReason: null,
      playback: onRoll(duration) ?? undefined,
    };
    attemptRef.current = current;
    setAttempt(current);
    setAnimateResult(false);
    setStage('rolling');

    try {
      await (reroll ? requestReroll() : requestRoll());
      if (attemptRef.current !== current) return;
      current.commandSettled = true;
      setAttempt({ ...current });
    } catch (cause) {
      if (attemptRef.current !== current) return;
      stopPlayback(current);
      publishAttempt(null);
      setResultMedia('poster');
      setAnimateResult(false);
      setStage(reroll && reward !== null ? 'result' : 'ready');
      setError(
        cause instanceof Error ? cause.message : 'Rolling Reward failed.',
      );
    }
  }

  function handleTerminal(
    attemptId: number,
    reason: RewardCubeTerminalReason,
  ): void {
    const current = attemptRef.current;
    if (current?.id !== attemptId || current.mediaReason !== null) {
      return;
    }
    stopPlayback(current);
    current.mediaReason = reason;
    setAttempt({ ...current });
  }

  const rerollsLeft = rerolls - usedRerolls;
  const displayedAttemptId = attempt?.id ?? nextAttemptIdRef.current;

  return (
    <Dialog
      open
      className="dialog--reward"
      title="Reward unlocked"
      onCancel={() => undefined}
    >
      <div className="reward-dialog__content">
        <RewardCube
          attemptId={displayedAttemptId}
          icon={reward?.icon ?? '✦'}
          stage={stage}
          resultMedia={resultMedia}
          reducedMotion={reducedMotion}
          animateResult={animateResult}
          onTerminal={handleTerminal}
        />
        {stage === 'result' && reward !== null ? (
          <div
            className="reward-result"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-animate={animateResult || undefined}
            data-reduced-motion={reducedMotion || undefined}
          >
            <h3>{reward.title}</h3>
            {reward.description === undefined ? null : (
              <p>{reward.description}</p>
            )}
          </div>
        ) : null}
        {error === null ? null : <p role="alert">{error}</p>}
      </div>
      <div ref={actionsRef} className="dialog__actions">
        {stage === 'result' ? (
          <>
            <Button
              variant="primary"
              pending={continuePending}
              pendingLabel="Continuing…"
              onClick={() => {
                void continueSession();
              }}
            >
              Continue
            </Button>
            {rerollsLeft > 0 ? (
              <Button
                variant="secondary"
                disabled={continuePending}
                onClick={() => {
                  void roll(true);
                }}
              >
                Roll again · {rerollsLeft} left
              </Button>
            ) : null}
          </>
        ) : stage === 'rolling' ? (
          <Button variant="primary" disabled>
            Rolling…
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              void roll(false);
            }}
          >
            Roll dice
          </Button>
        )}
      </div>
    </Dialog>
  );
}
