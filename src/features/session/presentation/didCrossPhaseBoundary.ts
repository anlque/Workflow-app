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
  const hasNewWorkflowRestartReceipt = current.restartCommandReceipts.some(
    (receipt) =>
      receipt.type === 'restart-workflow' &&
      !previous.restartCommandReceipts.some(
        (previousReceipt) => previousReceipt.commandId === receipt.commandId,
      ),
  );
  const isWorkflowRestartProjection =
    current.currentPhaseIndex === 0 &&
    (current.status === 'running' ||
      (current.status === 'paused' && current.pauseReason === 'user')) &&
    current.rewardRitual === undefined &&
    current.activeBonusPhase === undefined &&
    hasNewWorkflowRestartReceipt;
  if (isWorkflowRestartProjection) return false;
  if (hasNewWorkflowRestartReceipt) return true;
  if (previous.status === 'transitioning') return false;
  if (
    previous.activeBonusPhase !== undefined &&
    current.activeBonusPhase === undefined
  ) {
    const isNaturalFinalBonusCompletion =
      previous.rewardRitual?.continuation.type === 'complete' &&
      current.status === 'completed';
    return !isNaturalFinalBonusCompletion;
  }
  return (
    current.status === 'transitioning' ||
    current.currentPhaseIndex > previous.currentPhaseIndex ||
    current.status === 'completed'
  );
}
