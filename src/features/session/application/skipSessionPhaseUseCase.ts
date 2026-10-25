import {
  skipSessionPhase,
  type Session,
  type SessionPhaseTarget,
} from '../domain/Session';
import type { Clock } from './Clock';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function skipSessionPhaseUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
  commandId: string,
  target: SessionPhaseTarget,
): Promise<Session> {
  const current = await loadSession(repository, sessionId);
  const skipped = skipSessionPhase(current, clock.now(), commandId, target);
  if (skipped !== current) await repository.save(skipped);
  return skipped;
}
