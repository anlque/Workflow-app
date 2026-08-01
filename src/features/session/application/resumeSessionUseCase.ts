import { resumeSession, type RunningSession } from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function resumeSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
): Promise<RunningSession> {
  const resumed = resumeSession(
    await loadSession(repository, sessionId),
    clock.now(),
  );
  await repository.save(resumed);
  return resumed;
}
