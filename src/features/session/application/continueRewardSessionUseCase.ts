import { continueRewardSession, type Session } from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';
import { isDuplicateRewardCommand } from './rewardCommandReceipt';

export async function continueRewardSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
  commandId: string,
  rewardRitualId: string,
): Promise<Session> {
  const current = await loadSession(repository, sessionId);
  if (
    isDuplicateRewardCommand(current, commandId, 'continue', rewardRitualId)
  ) {
    return current;
  }
  const continued = continueRewardSession(current, clock.now(), commandId);
  await repository.save(continued);
  return continued;
}
