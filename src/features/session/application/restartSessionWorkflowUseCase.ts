import { restartSessionWorkflow, type Session } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { SessionTransitionError } from '../domain/SessionErrors';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function restartSessionWorkflowUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
  commandId: string,
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
  if (duplicate) return restartSessionWorkflow(current, now, commandId);
  const restarted = restartSessionWorkflow(
    deriveSessionState(current, now),
    now,
    commandId,
  );
  await repository.save(restarted);
  return restarted;
}
