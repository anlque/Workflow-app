import { createSessionId, type Session } from '../domain/Session';
import { SessionApplicationError } from './SessionApplicationError';
import type { SessionRepository } from './SessionRepository';

export async function loadSession(
  repository: SessionRepository,
  id: string,
): Promise<Session> {
  const sessionId = createSessionId(id);
  const session = await repository.get(sessionId);
  if (session === null) {
    throw new SessionApplicationError(`Session ${id} was not found.`);
  }

  return session;
}
