import { restartSessionPhase, type Session } from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import { isDuplicateRewardCommand } from './rewardCommandReceipt';
import type { SessionRepository } from './SessionRepository';

export async function restartSessionPhaseUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
  commandId: string,
  rewardRitualId: string,
): Promise<Session> {
  const current = await loadSession(repository, sessionId);
  if (isDuplicateRewardCommand(current, commandId, 'restart', rewardRitualId)) {
    return current;
  }
  const restarted = restartSessionPhase(current, clock.now(), commandId);
  await repository.save(restarted);
  return restarted;
}
