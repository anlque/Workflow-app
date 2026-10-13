import type { Session } from '../domain/Session';

export function didCrossPhaseBoundary(
  previous: Session,
  current: Session,
): boolean {
  if (previous.id !== current.id) return false;
  if (current.status === 'stopped') return false;
  if (previous.status === 'completed' || previous.status === 'stopped') {
    return false;
  }
  if (previous.status === 'transitioning') return false;
  const restartedWorkflow = current.restartCommandReceipts.some(
    (receipt) =>
      receipt.type === 'restart-workflow' &&
      !previous.restartCommandReceipts.some(
        (previousReceipt) => previousReceipt.commandId === receipt.commandId,
      ),
  );
  if (restartedWorkflow) return false;
  if (
    previous.activeBonusPhase !== undefined &&
    current.activeBonusPhase === undefined
  ) {
    return !(
      previous.rewardRitual?.continuation.type === 'complete' &&
      current.status === 'completed'
    );
  }
  return (
    current.status === 'transitioning' ||
    current.currentPhaseIndex > previous.currentPhaseIndex ||
    current.status === 'completed'
  );
}
