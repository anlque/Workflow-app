import { useEffect, useRef, useState } from 'react';

import { rollReward, type DiceSide, type Workflow } from '@/features/workflow';
import { Button, Dialog } from '@/shared';

import { RewardCube, type RewardCubeStage } from './RewardCube';

type MixingDuration = 600 | 2500;
type RewardStage = 'ready' | 'mixing' | 'result';

export type RewardResultDialogProps = Readonly<{
  workflow: Workflow;
  completedPhaseIndex: number;
  random: () => number;
  reducedMotion: boolean;
  onRoll(durationMs: MixingDuration): void;
  onContinue(): Promise<void>;
}>;

export function RewardResultDialog({
  workflow,
  completedPhaseIndex,
  random,
  reducedMotion,
  onRoll,
  onContinue,
}: RewardResultDialogProps) {
  const [stage, setStage] = useState<RewardStage>('ready');
  const [reward, setReward] = useState<DiceSide | null>(null);
  const [usedRerolls, setUsedRerolls] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const duration: MixingDuration = reducedMotion ? 600 : 2_500;
  const dice = workflow.rewardDice;
  if (dice === undefined) throw new Error('Reward Dice is required.');
  const rerolls = dice.rerolls;

  useEffect(() => {
    if (stage !== 'mixing') return;
    const timer = window.setTimeout(() => {
      setStage('result');
    }, duration);
    return () => {
      window.clearTimeout(timer);
    };
  }, [duration, stage]);

  useEffect(() => {
    if (stage === 'result' && usedRerolls > 0 && usedRerolls >= rerolls) {
      actionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [rerolls, stage, usedRerolls]);

  const cubeStage: RewardCubeStage =
    stage === 'mixing' && reducedMotion ? 'mixing-reduced' : stage;

  async function continueSession(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await onContinue();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Continuing Session failed.',
      );
    } finally {
      setPending(false);
    }
  }

  function roll(): void {
    setError(null);
    setReward(rollReward(workflow, completedPhaseIndex, random));
    setStage('mixing');
    onRoll(duration);
  }

  function reroll(): void {
    if (stage !== 'result' || usedRerolls >= rerolls) return;
    setUsedRerolls((count) => count + 1);
    roll();
  }

  const rerollsLeft = rerolls - usedRerolls;

  return (
    <Dialog
      open
      className="dialog--reward"
      title="Reward unlocked"
      onCancel={() => undefined}
    >
      <div className="reward-dialog__content">
        <RewardCube icon={reward?.icon ?? '✦'} stage={cubeStage} />
        {stage === 'result' && reward !== null ? (
          <div
            className="reward-result"
            role="status"
            aria-live="polite"
            aria-atomic="true"
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
        {stage === 'result' || usedRerolls > 0 ? (
          <>
            <Button
              variant="primary"
              disabled={stage === 'mixing'}
              pending={pending}
              pendingLabel="Continuing…"
              onClick={() => {
                void continueSession();
              }}
            >
              Continue
            </Button>
            {rerollsLeft > 0 || stage === 'mixing' ? (
              <Button
                variant="secondary"
                disabled={stage === 'mixing' || pending}
                onClick={reroll}
              >
                Roll again · {Math.max(rerollsLeft, 1)} left
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            variant="primary"
            disabled={stage !== 'ready'}
            onClick={() => {
              if (stage !== 'ready') return;
              roll();
            }}
          >
            Roll dice
          </Button>
        )}
      </div>
    </Dialog>
  );
}
