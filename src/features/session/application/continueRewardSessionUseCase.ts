import { continueRewardSession, type RunningSession } from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function continueRewardSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
): Promise<RunningSession> {
  const continued = continueRewardSession(
    await loadSession(repository, sessionId),
    clock.now(),
  );
  await repository.save(continued);
  return continued;
}
