import type { Session } from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import type { Clock } from './Clock';
import type { SessionRepository } from './SessionRepository';

export async function getActiveSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
): Promise<Session | null> {
  const current = await repository.getActive();
  if (current === null) {
    return null;
  }

  const reconciled = deriveSessionState(current, clock.now());
  if (reconciled !== current) {
    await repository.save(reconciled);
  }

  return reconciled.status === 'running' || reconciled.status === 'paused'
    ? reconciled
    : null;
}
