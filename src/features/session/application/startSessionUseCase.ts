import type { Workflow } from '@/features/workflow';

import { createSession, type RunningSession } from '../domain/Session';
import type { Clock } from './Clock';
import { SessionApplicationError } from './SessionApplicationError';
import type { SessionRepository } from './SessionRepository';

export async function startSessionUseCase(
  repository: SessionRepository,
  clock: Clock,
  sessionId: string,
  workflow: Workflow,
): Promise<RunningSession> {
  if ((await repository.getActive()) !== null) {
    throw new SessionApplicationError('An active Session already exists.');
  }

  const session = createSession(sessionId, workflow, clock.now());
  await repository.save(session);
  return session;
}
