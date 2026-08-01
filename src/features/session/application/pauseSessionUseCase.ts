import { pauseSession, type PausedSession } from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function pauseSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
): Promise<PausedSession> {
  const paused = pauseSession(
    await loadSession(repository, sessionId),
    clock.now(),
  );
  await repository.save(paused);
  return paused;
}
