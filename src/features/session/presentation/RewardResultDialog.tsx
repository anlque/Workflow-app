import { useCallback, useEffect, useState } from 'react';

import type { DiceSide } from '@/features/workflow';
import { Button, Dialog } from '@/shared';

import { RewardCube } from './RewardCube';

export type RewardResultDialogProps = Readonly<{
  reward: DiceSide;
  reducedMotion: boolean;
  onRoll?(): void;
  onDismiss(): void;
}>;

export function RewardResultDialog({
  reward,
  reducedMotion,
  onRoll,
  onDismiss,
}: RewardResultDialogProps) {
  const [settled, setSettled] = useState(reducedMotion);
  const settle = useCallback(() => {
    setSettled(true);
  }, []);

  useEffect(() => {
    onRoll?.();
  }, [onRoll, reward]);

  return (
    <Dialog open title="Reward unlocked" onCancel={onDismiss}>
      <RewardCube
        icon={reward.icon}
        reducedMotion={reducedMotion}
        onSettled={settle}
      />
      {settled ? (
        <div className="reward-result">
          <h3>{reward.title}</h3>
          {reward.description === undefined ? null : (
            <p>{reward.description}</p>
          )}
          <div className="dialog__actions">
            <Button variant="primary" onClick={onDismiss}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
