import {
  rerollSessionReward,
  rollSessionReward,
  type PausedSession,
} from '../domain/Session';
import { loadSession } from './loadSession';
import type { SessionRepository } from './SessionRepository';

export async function rollSessionRewardUseCase(
  repository: SessionRepository,
  sessionId: string,
  random: () => number,
  reroll = false,
  commandId?: string,
): Promise<PausedSession> {
  const current = await loadSession(repository, sessionId);
  if (
    commandId !== undefined &&
    current.status === 'paused' &&
    current.rewardRitual?.lastCommandId === commandId
  ) {
    return current;
  }
  const next = reroll
    ? rerollSessionReward(current, random, commandId)
    : rollSessionReward(current, random, commandId);
  if (next !== current) await repository.save(next);
  return next;
}
