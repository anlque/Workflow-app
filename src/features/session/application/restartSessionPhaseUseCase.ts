import { restartSessionPhase, type Session } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
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
  const now = clock.now();
  const reconciled = deriveSessionState(current, now);
  if (reconciled !== current) {
    await repository.save(reconciled);
  }
  if (
    isDuplicateRewardCommand(reconciled, commandId, 'restart', rewardRitualId)
  ) {
    return reconciled;
  }
  const restarted = restartSessionPhase(reconciled, now, commandId);
  await repository.save(restarted);
  return restarted;
}
