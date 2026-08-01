import type { CompletedSession, RunningSession, Session } from './Session';
import { validateEpochMilliseconds } from './validateEpochMilliseconds';

export function deriveSessionState(session: Session, now: number): Session {
  validateEpochMilliseconds(now);
  if (session.status !== 'running' || now < session.phaseEndsAt) {
    return session;
  }

  let currentPhaseIndex = session.currentPhaseIndex;
  let phaseStartedAt = session.phaseStartedAt;
  let phaseEndsAt = session.phaseEndsAt;

  while (now >= phaseEndsAt) {
    const nextPhaseIndex = currentPhaseIndex + 1;
    const nextPhase = session.snapshot.workflow.phases[nextPhaseIndex];
    if (nextPhase === undefined) {
      const completed: CompletedSession = Object.freeze({
        id: session.id,
        sourceWorkflowId: session.sourceWorkflowId,
        snapshot: session.snapshot,
        currentPhaseIndex,
        status: 'completed',
        completedAt: phaseEndsAt,
      });
      return completed;
    }

    currentPhaseIndex = nextPhaseIndex;
    phaseStartedAt = phaseEndsAt;
    phaseEndsAt = phaseStartedAt + nextPhase.durationSeconds * 1_000;
  }

  const advanced: RunningSession = Object.freeze({
    id: session.id,
    sourceWorkflowId: session.sourceWorkflowId,
    snapshot: session.snapshot,
    currentPhaseIndex,
    status: 'running',
    phaseStartedAt,
    phaseEndsAt,
  });
  return advanced;
}
