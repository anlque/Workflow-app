import { type Session } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function advanceSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
): Promise<Session> {
  const current = await loadSession(repository, sessionId);
  const advanced = deriveSessionState(current, clock.now());
  if (advanced !== current) {
    await repository.save(advanced);
  }
  return advanced;
}
