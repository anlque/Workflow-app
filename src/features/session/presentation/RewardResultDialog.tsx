import { useEffect, useState } from 'react';

import {
  rollReward,
  type DiceSide,
  type RewardDice,
} from '@/features/workflow';
import { Button, Dialog } from '@/shared';

import { RewardCube, type RewardCubeStage } from './RewardCube';

type MixingDuration = 600 | 2500;
type RewardStage = 'ready' | 'mixing' | 'result';

export type RewardResultDialogProps = Readonly<{
  dice: RewardDice;
  random: () => number;
  reducedMotion: boolean;
  onRoll(durationMs: MixingDuration): void;
  onContinue(): Promise<void>;
}>;

export function RewardResultDialog({
  dice,
  random,
  reducedMotion,
  onRoll,
  onContinue,
}: RewardResultDialogProps) {
  const [stage, setStage] = useState<RewardStage>('ready');
  const [reward, setReward] = useState<DiceSide | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duration: MixingDuration = reducedMotion ? 600 : 2_500;

  useEffect(() => {
    if (stage !== 'mixing') return;
    const timer = window.setTimeout(() => {
      setStage('result');
    }, duration);
    return () => {
      window.clearTimeout(timer);
    };
  }, [duration, stage]);

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

  return (
    <Dialog open title="Reward unlocked" onCancel={() => undefined}>
      <RewardCube icon={reward?.icon ?? '✦'} stage={cubeStage} />
      {stage === 'result' && reward !== null ? (
        <div className="reward-result">
          <h3>{reward.title}</h3>
          {reward.description === undefined ? null : (
            <p>{reward.description}</p>
          )}
        </div>
      ) : null}
      {error === null ? null : <p role="alert">{error}</p>}
      <div className="dialog__actions">
        {stage === 'result' ? (
          <Button
            variant="primary"
            pending={pending}
            pendingLabel="Continuing…"
            onClick={() => {
              void continueSession();
            }}
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={stage !== 'ready'}
            onClick={() => {
              if (stage !== 'ready') return;
              setReward(rollReward(dice, random));
              setStage('mixing');
              onRoll(duration);
            }}
          >
            Roll
          </Button>
        )}
      </div>
    </Dialog>
  );
}
