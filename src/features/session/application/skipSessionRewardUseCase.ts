import { skipSessionReward, type Session } from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function skipSessionRewardUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
  commandId: string,
  rewardRitualId: string,
): Promise<Session> {
  const current = await loadSession(repository, sessionId);
  const skipped = skipSessionReward(
    current,
    clock.now(),
    commandId,
    rewardRitualId,
  );
  if (skipped !== current) await repository.save(skipped);
  return skipped;
}
