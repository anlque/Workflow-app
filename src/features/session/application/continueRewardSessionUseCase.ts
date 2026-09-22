import { continueRewardSession, type Session } from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function continueRewardSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
  commandId: string,
): Promise<Session> {
  const current = await loadSession(repository, sessionId);
  if (
    current.rewardCommandReceipts.some(
      (receipt) => receipt.commandId === commandId,
    )
  ) {
    return current;
  }
  const continued = continueRewardSession(current, clock.now(), commandId);
  await repository.save(continued);
  return continued;
}
