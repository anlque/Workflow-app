import { stopSession, type StoppedSession } from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function stopSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
): Promise<StoppedSession> {
  const stopped = stopSession(
    await loadSession(repository, sessionId),
    clock.now(),
  );
  await repository.save(stopped);
  return stopped;
}
