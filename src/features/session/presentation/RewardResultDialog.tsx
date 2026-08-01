import type { DiceSide } from '@/features/workflow';
import { Button, Dialog } from '@/shared';

export type RewardResultDialogProps = Readonly<{
  reward: DiceSide;
  onDismiss(): void;
}>;

export function RewardResultDialog({
  reward,
  onDismiss,
}: RewardResultDialogProps) {
  return (
    <Dialog open title="Reward unlocked" onCancel={onDismiss}>
      <div className="reward-result">
        <span className="reward-result__icon" aria-hidden="true">
          {reward.icon}
        </span>
        <h3>{reward.title}</h3>
        {reward.description === undefined ? null : <p>{reward.description}</p>}
      </div>
      <div className="dialog__actions">
        <Button variant="primary" onClick={onDismiss}>
          Continue
        </Button>
      </div>
    </Dialog>
  );
}
