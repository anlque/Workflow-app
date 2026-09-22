import { isRewardDueAfterPhase } from '@/features/workflow';

import type {
  CompletedSession,
  PausedSession,
  RunningSession,
  Session,
  TransitioningSession,
} from './Session';
import { validateEpochMilliseconds } from './validateEpochMilliseconds';

export function deriveSessionState(session: Session, now: number): Session {
  validateEpochMilliseconds(now);
  let current = session;
  while (current.status === 'running' || current.status === 'transitioning') {
    if (current.status === 'running') {
      if (now < current.phaseEndsAt) return current;
      const transitioning: TransitioningSession = Object.freeze({
        id: current.id,
        sourceWorkflowId: current.sourceWorkflowId,
        snapshot: current.snapshot,
        currentPhaseIndex: current.currentPhaseIndex,
        rewardCommandReceipts: current.rewardCommandReceipts,
        status: 'transitioning',
        transitionEndsAt: current.phaseEndsAt + 1_000,
      });
      current = transitioning;
      continue;
    }

    if (now < current.transitionEndsAt) return current;
    const nextPhaseIndex = current.currentPhaseIndex + 1;
    const nextPhase = current.snapshot.workflow.phases[nextPhaseIndex];
    if (
      isRewardDueAfterPhase(
        current.snapshot.workflow,
        current.currentPhaseIndex,
      )
    ) {
      const paused: PausedSession = Object.freeze({
        id: current.id,
        sourceWorkflowId: current.sourceWorkflowId,
        snapshot: current.snapshot,
        currentPhaseIndex:
          nextPhase === undefined ? current.currentPhaseIndex : nextPhaseIndex,
        rewardCommandReceipts: current.rewardCommandReceipts,
        status: 'paused',
        pauseReason: 'reward',
        pausedAt: current.transitionEndsAt,
        remainingMilliseconds:
          nextPhase === undefined ? 0 : nextPhase.durationSeconds * 1_000,
        rewardRitual: Object.freeze({
          id: `${current.id}:${String(current.currentPhaseIndex)}`,
          completedPhaseIndex: current.currentPhaseIndex,
          rerollsUsed: 0,
          acknowledged: false,
          continuation:
            nextPhase === undefined
              ? Object.freeze({ type: 'complete' as const })
              : Object.freeze({
                  type: 'phase' as const,
                  phaseIndex: nextPhaseIndex,
                }),
        }),
      });
      return paused;
    }
    if (nextPhase === undefined) {
      const completed: CompletedSession = Object.freeze({
        id: current.id,
        sourceWorkflowId: current.sourceWorkflowId,
        snapshot: current.snapshot,
        currentPhaseIndex: current.currentPhaseIndex,
        rewardCommandReceipts: current.rewardCommandReceipts,
        status: 'completed',
        completedAt: current.transitionEndsAt,
      });
      return completed;
    }

    const running: RunningSession = Object.freeze({
      id: current.id,
      sourceWorkflowId: current.sourceWorkflowId,
      snapshot: current.snapshot,
      currentPhaseIndex: nextPhaseIndex,
      rewardCommandReceipts: current.rewardCommandReceipts,
      status: 'running',
      phaseStartedAt: current.transitionEndsAt,
      phaseEndsAt: current.transitionEndsAt + nextPhase.durationSeconds * 1_000,
    });
    current = running;
  }
  return current;
}
