import {
  restartSessionPhase,
  type SessionPhaseTarget,
  type Session,
} from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { SessionTransitionError } from '../domain/SessionErrors';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function restartSessionPhaseUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
  commandId: string,
  target: SessionPhaseTarget,
): Promise<Session> {
  const current = await loadSession(repository, sessionId);
  const now = clock.now();
  if (
    current.rewardCommandReceipts.some(
      (receipt) => receipt.commandId === commandId,
    )
  )
    throw new SessionTransitionError();
  const duplicate = current.restartCommandReceipts.some(
    (receipt) => receipt.commandId === commandId,
  );
  if (duplicate) return restartSessionPhase(current, now, commandId, target);
  const reconciled = deriveSessionState(current, now);
  const restarted = restartSessionPhase(reconciled, now, commandId, target);
  await repository.save(restarted);
  return restarted;
}
